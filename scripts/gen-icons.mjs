/**
 * Genereert eenvoudige Buisz-placeholder-iconen als PNG (zonder externe deps).
 *
 * Antraciet achtergrond met een Buisgroen "play"-blok in het midden. Bedoeld als
 * werkbare placeholder voor de platform-pakketten; vervang door echte artwork.
 *
 *   node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// CRC32 (PNG gebruikt de standaard IEEE-tabel).
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const BG = hex('#13181b') // antraciet
const FG = hex('#34e3a8') // buisgroen

/** Tekent een Buisgroen kader + "play"-driehoek op antraciet; w×h. */
function pngPlay(w, h) {
  const s = Math.min(w, h)
  const cx = w / 2
  const cy = h / 2
  const inset = s * 0.26
  const triLeft = cx - s * 0.1
  const triRight = cx + s * 0.16
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) {
    const rowStart = y * (w * 4 + 1)
    raw[rowStart] = 0 // filter: none
    for (let x = 0; x < w; x++) {
      let [r, g, b] = BG
      const onBorder =
        (x > cx - (s / 2 - inset) && x < cx + (s / 2 - inset) &&
          (Math.abs(y - (cy - (s / 2 - inset))) < s * 0.02 || Math.abs(y - (cy + (s / 2 - inset))) < s * 0.02)) ||
        (y > cy - (s / 2 - inset) && y < cy + (s / 2 - inset) &&
          (Math.abs(x - (cx - (s / 2 - inset))) < s * 0.02 || Math.abs(x - (cx + (s / 2 - inset))) < s * 0.02))
      const t = (x - triLeft) / (triRight - triLeft)
      const half = s * 0.16 * (1 - t)
      const inTriangle = t >= 0 && t <= 1 && Math.abs(y - cy) <= half
      if (inTriangle || onBorder) [r, g, b] = FG
      const p = rowStart + 1 + x * 4
      raw[p] = r
      raw[p + 1] = g
      raw[p + 2] = b
      raw[p + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const targets = [
  ['platforms/tizen/icon.png', 512, 512],
  ['platforms/webos/icon.png', 80, 80],
  ['platforms/webos/largeIcon.png', 130, 130],
  ['platforms/android/banner.png', 320, 180], // TV-leanback-banner (verplicht)
]

for (const [path, w, h] of targets) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, pngPlay(w, h))
  console.log(`✓ ${path} (${w}x${h})`)
}
