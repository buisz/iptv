/**
 * SSRF-bescherming voor de proxy (Node-pad: dev-middleware + self-host-server).
 *
 * De proxy haalt een door de client opgegeven URL op. Zonder bescherming kan die
 * naar interne/loopback/metadata-hosts wijzen (SSRF) of als open relay dienen.
 * Deze module:
 *  - staat alleen http/https toe;
 *  - blokkeert hosts die naar private/loopback/link-local/ULA/CGNAT/metadata-IP's
 *    resolven (v4 én v6), vóór de fetch én opnieuw na elke redirect;
 *  - ondersteunt een optionele host-allowlist via BUISZ_ALLOWED_HOSTS
 *    (komma-gescheiden; subdomeinen toegestaan).
 *  - redigeert credentials in URL's voor logging.
 *
 * Alleen Node-ingebouwde modules.
 */
import dns from 'node:dns/promises'

const ALLOW = (process.env.BUISZ_ALLOWED_HOSTS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

function ipToLong(ip) {
  const p = ip.split('.')
  if (p.length !== 4) return null
  let n = 0
  for (const o of p) {
    const v = Number(o)
    if (!Number.isInteger(v) || v < 0 || v > 255) return null
    n = n * 256 + v
  }
  return n >>> 0
}

function v4InRange(n, cidrBase, bits) {
  const base = ipToLong(cidrBase)
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (n & mask) === (base & mask)
}

/** Is een IP (v4 of v6-tekst) privé/intern en dus verboden? */
export function isBlockedIp(ip) {
  if (!ip) return true
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) → check de v4.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)
  if (mapped) return isBlockedIp(mapped[1])

  if (ip.includes(':')) {
    // IPv6
    const low = ip.toLowerCase()
    if (low === '::1' || low === '::') return true // loopback / unspecified
    if (low.startsWith('fe80') || low.startsWith('fe9') || low.startsWith('fea') || low.startsWith('feb')) return true // link-local fe80::/10
    const first = parseInt(low.split(':')[0] || '0', 16)
    if ((first & 0xfe00) === 0xfc00) return true // ULA fc00::/7
    return false
  }

  const n = ipToLong(ip)
  if (n === null) return true // onparseerbaar → weiger
  return (
    v4InRange(n, '0.0.0.0', 8) || // "dit netwerk"
    v4InRange(n, '10.0.0.0', 8) ||
    v4InRange(n, '100.64.0.0', 10) || // CGNAT
    v4InRange(n, '127.0.0.0', 8) || // loopback
    v4InRange(n, '169.254.0.0', 16) || // link-local + metadata 169.254.169.254
    v4InRange(n, '172.16.0.0', 12) ||
    v4InRange(n, '192.0.0.0', 24) ||
    v4InRange(n, '192.168.0.0', 16) ||
    v4InRange(n, '198.18.0.0', 15) || // benchmark
    v4InRange(n, '224.0.0.0', 4) || // multicast
    v4InRange(n, '240.0.0.0', 4) // gereserveerd
  )
}

/** Werp bij een onveilige/verboden target-URL; geeft de geparste URL terug. */
export async function assertSafeUrl(raw) {
  let u
  try {
    u = new URL(raw)
  } catch {
    throw new Error('ongeldige URL')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('alleen http/https toegestaan')
  const host = u.hostname.toLowerCase()
  if (ALLOW.length && !ALLOW.some((h) => host === h || host.endsWith('.' + h))) {
    throw new Error('host niet in allowlist')
  }
  let addrs
  try {
    addrs = await dns.lookup(host, { all: true })
  } catch {
    throw new Error('host niet te resolven')
  }
  for (const a of addrs) {
    if (isBlockedIp(a.address)) throw new Error('interne/private host geblokkeerd')
  }
  return u
}

/**
 * Fetch met SSRF-guard: valideert de target én elke redirect-hop (redirect:manual),
 * zodat een externe redirect niet alsnog naar een interne host kan wijzen.
 */
export async function safeFetch(target, options = {}, maxRedirects = 5) {
  let current = target
  for (let i = 0; i <= maxRedirects; i++) {
    await assertSafeUrl(current)
    const res = await fetch(current, { ...options, redirect: 'manual' })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current).toString()
      continue
    }
    return res
  }
  throw new Error('te veel redirects')
}

/** Maskeer Xtream-credentials in een URL voordat je 'm logt. */
export function redactUrl(raw) {
  try {
    const u = new URL(raw)
    for (const k of ['username', 'password']) if (u.searchParams.has(k)) u.searchParams.set(k, '***')
    // Pad-credentials: /live/<user>/<pass>/<id>.ts → maskeer segment 2 en 3.
    u.pathname = u.pathname.replace(
      /\/(live|movie|series)\/[^/]+\/[^/]+\//i,
      (_m, kind) => `/${kind}/***/***/`,
    )
    if (u.password) u.password = '***'
    if (u.username) u.username = '***'
    return u.toString()
  } catch {
    return '(onleesbare URL)'
  }
}
