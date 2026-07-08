/**
 * In-memory response-cache + per-host limiet voor de proxy.
 *
 * Waarom in de proxy en niet (alleen) in de client: de proxy is het knelpunt naar de
 * provider. Cachen hier betekent dat een reload of een tweede tab/toestel de provider
 * niet opnieuw bevraagt → veel minder 429's en instant reloads. Alleen data/EPG/logo's
 * worden gecachet (geen live-streams).
 *
 * Bewust simpel: een Map met TTL + een byte-budget (oudste eruit als het budget vol is),
 * en een per-host semafoor als backstop tegen bursts.
 */

const store = new Map() // key(url) -> { body: Buffer, contentType, expires }
let totalBytes = 0
const MAX_BYTES = 96 * 1024 * 1024 // ~96 MB budget
const MAX_ENTRY = 20 * 1024 * 1024 // grotere responses niet cachen

/** TTL (ms) op basis van content-type: logo's lang, API kort, EPG/XML middellang. */
export function ttlFor(contentType) {
  const ct = (contentType || '').toLowerCase()
  if (ct.startsWith('image/')) return 6 * 60 * 60 * 1000 // 6 uur
  if (ct.includes('xml')) return 15 * 60 * 1000 // 15 min (EPG/XMLTV)
  if (ct.includes('json')) return 5 * 60 * 1000 // 5 min (catalogus-API)
  return 5 * 60 * 1000
}

export function cacheGet(key) {
  const e = store.get(key)
  if (!e) return null
  if (e.expires <= Date.now()) {
    store.delete(key)
    totalBytes -= e.body.length
    return null
  }
  // LRU-touch: naar achter verplaatsen.
  store.delete(key)
  store.set(key, e)
  return e
}

export function cacheSet(key, body, contentType, ttl) {
  if (!body || body.length > MAX_ENTRY || ttl <= 0) return
  const existing = store.get(key)
  if (existing) totalBytes -= existing.body.length
  store.set(key, { body, contentType, expires: Date.now() + ttl })
  totalBytes += body.length
  while (totalBytes > MAX_BYTES) {
    const oldest = store.keys().next().value
    if (oldest === undefined) break
    const o = store.get(oldest)
    store.delete(oldest)
    totalBytes -= o.body.length
  }
}

// ── Per-host limiet (backstop tegen bursts, naast de adaptieve client-limiter) ──
const gates = new Map() // host -> { active, queue }
const HOST_LIMIT = 6

export async function withHostLimit(host, fn) {
  let g = gates.get(host)
  if (!g) {
    g = { active: 0, queue: [] }
    gates.set(host, g)
  }
  if (g.active >= HOST_LIMIT) await new Promise((r) => g.queue.push(r))
  g.active++
  try {
    return await fn()
  } finally {
    g.active--
    g.queue.shift()?.()
  }
}

export function hostOf(target) {
  try {
    return new URL(target).host
  } catch {
    return 'default'
  }
}
