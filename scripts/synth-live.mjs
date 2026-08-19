/**
 * Synthetische live MPEG-TS-bron voor het testen/valideren van live-afspelen
 * (o.a. de "MediaSource onSourceEnded"-regressie) ZONDER een echte provider.
 *
 * Serveert een oneindige, real-time H.264+AAC MPEG-TS over een nooit-sluitende
 * chunked HTTP-respons. Elk pad werkt (…/live/1, …/1, …/x.ts) — de app routeert
 * op patroon naar mpegts.js in live-modus.
 *
 * Gebruik:
 *   node scripts/synth-live.mjs          # vereist ffmpeg op PATH
 *   → http://127.0.0.1:7000/live/1
 *
 * Geen ffmpeg? Zie docs/testing-live.md voor een bestand-loop-alternatief.
 *
 * Zie docs/testing-live.md voor de volledige test-/validatie-stappen.
 */
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'

const PORT = Number(process.env.SYNTH_PORT) || 7000

// H.264 + AAC MPEG-TS, real-time (-re), kleine GOP voor een stabiele live-rand.
// lavfi-bronnen zijn oneindig → de respons eindigt nooit (echte "live").
const FFMPEG_ARGS = [
  '-hide_banner', '-loglevel', 'warning',
  '-re',
  '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=25',
  '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=48000',
  '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
  '-g', '50', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-ar', '48000', '-b:a', '128k',
  '-f', 'mpegts', '-muxdelay', '0', 'pipe:1',
]

createServer((req, res) => {
  res.writeHead(200, {
    'content-type': 'video/mp2t',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
    // BEWUST geen content-length: een live-feed is oneindig.
  })
  const ff = spawn('ffmpeg', FFMPEG_ARGS, { stdio: ['ignore', 'pipe', 'inherit'] })
  ff.stdout.pipe(res)
  const kill = () => {
    try {
      ff.kill('SIGKILL')
    } catch {
      /* al gestopt */
    }
  }
  req.on('close', kill)
  res.on('close', kill)
  ff.on('error', (e) => {
    console.error('ffmpeg-fout (staat het op PATH?):', e.message)
    kill()
    if (!res.headersSent) res.writeHead(500)
    res.end()
  })
}).listen(PORT, '127.0.0.1', () =>
  console.log(`Synthetische live-TS op http://127.0.0.1:${PORT}/live/1`),
)
