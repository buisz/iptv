/**
 * Routeert externe verzoeken via een CORS-proxy.
 *
 * - In dev: via de Vite-middleware op `/__proxy` (zie vite.config.ts).
 * - In productie (web): via `VITE_PROXY_BASE` indien gezet — bijv. `/__proxy`
 *   wanneer je achter `server/proxy.mjs` draait.
 * - Op de doel-box met native netwerklaag is er geen browser-CORS en kan
 *   `VITE_PROXY_BASE` leeg blijven; dan gaat het verkeer rechtstreeks.
 */
/**
 * @param opts.stream  Zet `stream=1` in de proxy-URL. Alleen dán mag de proxy een
 *   niet-video-antwoord (HTML/JSON-foutpagina) als 502 afkeuren. Voor gewone data-
 *   calls (Xtream `player_api.php` geeft legitiem JSON!) blijft dit uit, anders zou
 *   de proxy geldige API-antwoorden ten onrechte als foutpagina weigeren.
 */
export function proxied(url: string, opts?: { stream?: boolean }): string {
  const query = `url=${encodeURIComponent(url)}${opts?.stream ? '&stream=1' : ''}`
  if (import.meta.env.DEV) {
    return absolute(`/__proxy?${query}`)
  }
  const base = import.meta.env.VITE_PROXY_BASE
  if (base) {
    return absolute(`${base}?${query}`)
  }
  // Anders: de ingestelde koppel-Worker biedt ook /proxy aan.
  const worker = workerProxyBase()
  if (worker) {
    return `${worker}/proxy?${query}`
  }
  return url
}

/**
 * Maak een pad absoluut t.o.v. de app-origin.
 *
 * Cruciaal voor mpegts.js: dat draait zijn fetch ín een Web Worker (blob:-URL).
 * Een root-relatieve `/__proxy?...` heeft daar geen basis → "Failed to parse URL".
 * Met een volledige `http://host/__proxy?...` werkt het overal (main thread én worker).
 */
function absolute(pathOrUrl: string): string {
  const origin = globalThis.location?.origin
  if (!origin) return pathOrUrl
  try {
    return new URL(pathOrUrl, origin).toString()
  } catch {
    return pathOrUrl
  }
}

/** Worker-basis uit env of de in Instellingen bewaarde URL (alleen in productie nuttig). */
function workerProxyBase(): string {
  const env = import.meta.env.VITE_PAIR_BASE
  if (env) return env.replace(/\/$/, '')
  try {
    return (localStorage.getItem('buisz.pairBase') || '').replace(/\/$/, '')
  } catch {
    return ''
  }
}

// ── Adaptieve, per-provider rate-limiting van data-calls ─────────────────────
// Providers throttelen API-calls (429), maar hun limieten kennen we niet — zeker
// niet voor onbekende providers. Daarom is dit zelf-lerend (AIMD, zoals TCP): start
// voorzichtig, bij 429/503 halveren we de toegestane gelijktijdigheid (en houden een
// cooldown aan, met respect voor Retry-After), en bij aanhoudend succes klimmen we
// weer voorzichtig op. Alles **per host**, zodat elke provider zijn eigen budget krijgt.
// Geldt alleen voor data (catalogus/EPG); video-streams lopen hier buiten om.
// Deze laag zit in de gedeelde data-code, dus het werkt op elk platform (web/PWA/TV;
// ook de native app draait deze TS).
const START_LIMIT = 4
const MIN_LIMIT = 1
const MAX_LIMIT = 8
const GROW_AFTER = 6 // opeenvolgende successen vóór we de limiet met 1 verhogen

const MIN_GAP = 120 // ms min-interval tussen call-starts (pacing), adaptief
const MAX_GAP = 1500

interface HostLimiter {
  limit: number
  active: number
  queue: Array<() => void>
  successStreak: number
  cooldownUntil: number
  gap: number // min-interval tussen starts
  lastStart: number
}
const limiters = new Map<string, HostLimiter>()

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return 'default'
  }
}
function limiterFor(host: string): HostLimiter {
  let l = limiters.get(host)
  if (!l) {
    l = { limit: START_LIMIT, active: 0, queue: [], successStreak: 0, cooldownUntil: 0, gap: MIN_GAP, lastStart: 0 }
    limiters.set(host, l)
  }
  return l
}
function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function acquire(l: HostLimiter): Promise<void> {
  if (l.active >= l.limit) await new Promise<void>((r) => l.queue.push(r))
  l.active++
  // Pacing: houd een min-interval tussen call-starts aan, plus een lopende cooldown
  // (na 429). We claimen het start-slot meteen zodat parallelle acquires niet
  // samenklonteren, en wachten dan tot dat slot bereikt is.
  const now = Date.now()
  const startAt = Math.max(now, l.lastStart + l.gap, l.cooldownUntil)
  l.lastStart = startAt
  if (startAt > now) await wait(startAt - now)
}
function release(l: HostLimiter): void {
  l.active--
  l.queue.shift()?.()
}
function onThrottled(l: HostLimiter, retryAfterMs: number): void {
  l.limit = Math.max(MIN_LIMIT, Math.floor(l.limit / 2))
  l.gap = Math.min(MAX_GAP, Math.round(l.gap * 1.8)) // trager tempo
  l.successStreak = 0
  l.cooldownUntil = Math.max(l.cooldownUntil, Date.now() + retryAfterMs)
}
function onSuccess(l: HostLimiter): void {
  if (++l.successStreak >= GROW_AFTER) {
    if (l.limit < MAX_LIMIT) l.limit++
    l.gap = Math.max(MIN_GAP, Math.round(l.gap * 0.8)) // langzaam weer versnellen
    l.successStreak = 0
  }
}

/**
 * Data-fetch via de proxy met adaptieve, per-host limiet.
 *
 * @param background  Achtergrond-call (bijv. EPG per tegel): bij 429/503 NIET
 *   retryen — dat zou de storm juist versterken. We laten de limiter er wél van
 *   leren (terugschroeven) en geven de 429-respons terug; de aanroeper toont dan
 *   simpelweg geen data. Voorgrond-calls (catalogus) retryen wél met backoff.
 */
async function dataFetch(url: string, signal?: AbortSignal, background = false): Promise<Response> {
  const l = limiterFor(hostOf(url))
  await acquire(l)
  try {
    let res = await fetch(proxied(url), { signal })
    if (res.status === 429 || res.status === 503) {
      const retryAfter = Number(res.headers.get('retry-after'))
      const base = retryAfter > 0 ? retryAfter * 1000 : 500
      if (background) {
        onThrottled(l, base) // leren, maar niet opnieuw proberen
      } else {
        for (let attempt = 0; (res.status === 429 || res.status === 503) && attempt < 4; attempt++) {
          const backoff = retryAfter > 0 ? retryAfter * 1000 : Math.min(8000, 500 * 2 ** attempt)
          onThrottled(l, backoff)
          await wait(backoff)
          if (signal?.aborted) break
          res = await fetch(proxied(url), { signal })
        }
      }
    }
    if (res.ok) onSuccess(l)
    return res
  } finally {
    release(l)
  }
}

/** Haal tekst op via de proxy met een nette foutmelding. */
export async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const res = await dataFetch(url, signal)
  if (!res.ok) {
    throw new Error(`Ophalen mislukt (${res.status}) voor ${shorten(url)}`)
  }
  return res.text()
}

/** Haal JSON op via de proxy. Xtream geeft soms tekst/HTML bij fouten — vang dat af. */
export async function fetchJson<T = unknown>(
  url: string,
  signal?: AbortSignal,
  opts?: { background?: boolean },
): Promise<T> {
  const res = await dataFetch(url, signal, opts?.background)
  if (!res.ok) {
    throw new Error(`Server antwoordde ${res.status} voor ${shorten(url)}`)
  }
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Onverwacht antwoord van de server (geen geldige JSON).')
  }
}

function shorten(url: string): string {
  return url.length > 60 ? `${url.slice(0, 57)}…` : url
}
