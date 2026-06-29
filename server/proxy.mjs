/**
 * Productie-/self-host server (fase 3).
 *
 * Serveert de gebouwde web-app uit `dist/` én biedt dezelfde CORS-proxy als in
 * dev op `/__proxy?url=…`. Zo werkt een web-deploy (buiten een box) ook met
 * echte Xtream-/M3U-/EPG-bronnen die geen CORS-headers sturen.
 *
 * Bouwen met de proxy ingeschakeld in de client:
 *   VITE_PROXY_BASE=/__proxy npm run build
 *   node server/proxy.mjs           # standaard op poort 4173
 *
 * Alleen Node-ingebouwde modules; geen extra dependencies.
 *
 * Let op: dit is een open relay voor je eigen gebruik. Zet 'm niet zomaar
 * publiek open zonder toegangsbeperking.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, normalize, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const PORT = Number(process.env.PORT) || 4173

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

async function handleProxy(req, res, target) {
  if (!target) {
    res.writeHead(400)
    res.end('ontbrekende ?url parameter')
    return
  }
  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'BuiszIPTV/0.1 (proxy)' },
      redirect: 'follow',
    })
    res.statusCode = upstream.status
    const ct = upstream.headers.get('content-type')
    if (ct) res.setHeader('content-type', ct)
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('cache-control', 'no-store')
    const buf = Buffer.from(await upstream.arrayBuffer())
    res.end(buf)
  } catch (err) {
    res.writeHead(502)
    res.end(`proxy-fout: ${err.message}`)
  }
}

async function serveStatic(res, urlPath) {
  // Voorkom path-traversal; val terug op index.html (SPA).
  let rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '')
  if (rel === '/' || rel === '') rel = '/index.html'
  let file = join(DIST, rel)

  try {
    const info = await stat(file)
    if (info.isDirectory()) file = join(file, 'index.html')
  } catch {
    file = join(DIST, 'index.html') // SPA-fallback
  }

  try {
    const body = await readFile(file)
    res.setHeader('content-type', MIME[extname(file)] ?? 'application/octet-stream')
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('Niet gevonden. Heb je al `npm run build` gedraaid?')
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  if (url.pathname === '/__proxy') {
    await handleProxy(req, res, url.searchParams.get('url'))
    return
  }
  await serveStatic(res, url.pathname)
}).listen(PORT, () => {
  console.log(`Buisz draait op http://localhost:${PORT}  (proxy: /__proxy)`)
})
