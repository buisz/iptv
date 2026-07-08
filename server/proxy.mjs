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
import { Readable } from 'node:stream'
import { isM3u8, looksLikeErrorPage, rewriteM3u8, STREAM_UA } from './m3u8.mjs'

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

async function handleProxy(req, res, target, isStream = false) {
  if (!target) {
    res.writeHead(400)
    res.end('ontbrekende ?url parameter')
    return
  }
  try {
    const headers = { 'User-Agent': STREAM_UA }
    if (req.headers.range) headers['range'] = req.headers.range
    const upstream = await fetch(target, { headers, redirect: 'follow' })

    res.statusCode = upstream.status
    const contentType = upstream.headers.get('content-type')

    // HLS-manifest: buffer + herschrijf URI's naar absoluut (klein, eindig).
    if (isM3u8(contentType, target)) {
      const text = rewriteM3u8(await upstream.text(), target)
      res.setHeader('content-type', contentType || 'application/vnd.apple.mpegurl')
      res.setHeader('access-control-allow-origin', '*')
      res.setHeader('cache-control', 'no-store')
      res.end(text)
      return
    }

    // Foutpagina i.p.v. video (HTML/JSON): eerlijke 502 met snippet.
    // Alleen voor stream-verzoeken — API-calls geven legitiem JSON terug.
    if (isStream && looksLikeErrorPage(contentType)) {
      const snippet = (await upstream.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
      res.statusCode = 502
      res.setHeader('content-type', 'text/plain; charset=utf-8')
      res.setHeader('access-control-allow-origin', '*')
      res.end(`Upstream gaf een foutpagina i.p.v. video: ${snippet || '(leeg)'}`)
      return
    }

    for (const h of ['content-type', 'content-range', 'accept-ranges', 'content-length']) {
      const v = upstream.headers.get(h)
      if (v) res.setHeader(h, v)
    }
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('cache-control', 'no-store')

    if (!upstream.body) {
      res.end()
      return
    }
    // Pipe i.p.v. bufferen, zodat live-streams blijven doorlopen.
    const stream = Readable.fromWeb(upstream.body)
    stream.on('error', () => res.destroy())
    req.on('close', () => stream.destroy())
    stream.pipe(res)
  } catch (err) {
    if (!res.headersSent) res.writeHead(502)
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
    await handleProxy(req, res, url.searchParams.get('url'), url.searchParams.get('stream') === '1')
    return
  }
  await serveStatic(res, url.pathname)
}).listen(PORT, () => {
  console.log(`Buisz draait op http://localhost:${PORT}  (proxy: /__proxy)`)
})
