import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

/**
 * Dev-proxy voor CORS.
 *
 * Echte Xtream-servers en M3U-URL's sturen geen CORS-headers, dus de browser
 * blokkeert ze. Tijdens lokale ontwikkeling halen we ze server-side op via
 * `/__proxy?url=<encoded>` en sturen we ze CORS-vrij terug. Dit is uitdrukkelijk
 * alleen een dev-hulpmiddel; in een verpakte box-app gaat verkeer rechtstreeks.
 */
function devProxy(): Plugin {
  return {
    name: 'buisz-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/__proxy', async (req, res) => {
        try {
          const requestUrl = new URL(req.url ?? '', 'http://localhost')
          const target = requestUrl.searchParams.get('url')
          if (!target) {
            res.statusCode = 400
            res.end('ontbrekende ?url parameter')
            return
          }
          const upstream = await fetch(target, {
            headers: { 'User-Agent': 'BuiszIPTV/0.1 (dev-proxy)' },
            redirect: 'follow',
          })
          res.statusCode = upstream.status
          const contentType = upstream.headers.get('content-type')
          if (contentType) res.setHeader('content-type', contentType)
          res.setHeader('access-control-allow-origin', '*')
          res.setHeader('cache-control', 'no-store')
          const body = Buffer.from(await upstream.arrayBuffer())
          res.end(body)
        } catch (err) {
          res.statusCode = 502
          res.end(`proxy-fout: ${(err as Error).message}`)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // ES5/legacy-bundel voor oude TV-engines (Tizen 3.0/Chromium M47,
    // LG webOS 3.5/Chromium 38, oude Android-WebView). Moderne browsers krijgen
    // de gewone ES2015-modulebundel; oude engines vallen via `nomodule` terug op
    // de getranspileerde ES5-bundel met core-js-polyfills (SystemJS-loader).
    legacy({
      targets: ['chrome >= 38', 'edge >= 18', 'firefox >= 60', 'safari >= 11'],
      // fetch (Chrome <42) en async/await→regenerator voor de oudste targets.
      additionalLegacyPolyfills: ['regenerator-runtime/runtime', 'whatwg-fetch'],
      // Ook de "moderne" bundel polyfillen: webOS 6 = Chromium 79 en Tizen 2021
      // = M76 missen bijv. String.prototype.replaceAll (Chrome 85).
      modernPolyfills: true,
      renderLegacyChunks: true,
    }),
    devProxy(),
  ],
  build: {
    // Moderne bundel op ES2015 (alle module-capable engines zijn Chromium 61+).
    target: 'es2015',
  },
  server: {
    host: true,
    port: 5173,
  },
})
