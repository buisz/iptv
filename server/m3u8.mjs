/**
 * Herschrijft een HLS-playlist (m3u8) zodat álle URI's absoluut worden.
 *
 * Waarom: de browser-speler (hls.js) haalt de manifest via de proxy op, maar de
 * segment-/child-URI's die erin staan zijn vaak relatief. Zonder herschrijven zou
 * de speler die relatief t.o.v. het proxy-pad oplossen (`/__proxy?url=…`) → kapot.
 * Door ze hier absoluut te maken (t.o.v. de échte upstream-URL) krijgt de speler
 * volledige URL's terug, die hij vervolgens zélf weer door de proxy stuurt.
 *
 * We laten de proxy-mount bewust buiten beschouwing: dit maakt alleen absoluut,
 * de client bepaalt hoe hij proxyt.
 */

/** Is dit waarschijnlijk een m3u8-playlist? (content-type of extensie). */
export function isM3u8(contentType, targetUrl) {
  const ct = (contentType || '').toLowerCase()
  if (ct.includes('mpegurl')) return true
  try {
    return /\.m3u8(\?|$)/i.test(new URL(targetUrl).pathname + new URL(targetUrl).search)
  } catch {
    return /\.m3u8(\?|$)/i.test(targetUrl || '')
  }
}

/** Maakt elke segment-/URI-verwijzing in de playlist absoluut t.o.v. baseUrl. */
export function rewriteM3u8(text, baseUrl) {
  const abs = (u) => {
    try {
      return new URL(u, baseUrl).toString()
    } catch {
      return u
    }
  }
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (trimmed.startsWith('#')) {
        // Tags met inline URI="..." (EXT-X-KEY, EXT-X-MEDIA, EXT-X-MAP, I-FRAME…).
        return line.replace(/URI="([^"]*)"/g, (_m, u) => `URI="${abs(u)}"`)
      }
      // Losse regel = segment- of child-playlist-URI.
      return abs(trimmed)
    })
    .join('\n')
}
