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

// ── Rate-limiting van data-calls ──────────────────────────────────────────────
// Providers throttelen API-calls (429). We houden het aantal gelijktijdige
// data-verzoeken laag (semafoor) en retryen 429/503 met backoff. Dit geldt alléén
// voor data (catalogus/EPG); video-streams lopen buiten deze wrapper om.
const MAX_CONCURRENT = 4
let active = 0
const waiters: Array<() => void> = []

async function acquire(): Promise<void> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((r) => waiters.push(r))
  active++
}
function release(): void {
  active--
  waiters.shift()?.()
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Data-fetch via de proxy met concurrency-limiet en 429/503-retry (backoff). */
async function dataFetch(url: string, signal?: AbortSignal): Promise<Response> {
  await acquire()
  try {
    let res = await fetch(proxied(url), { signal })
    for (let attempt = 0; (res.status === 429 || res.status === 503) && attempt < 3; attempt++) {
      const retryAfter = Number(res.headers.get('retry-after'))
      const delay = retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt
      await wait(delay)
      if (signal?.aborted) break
      res = await fetch(proxied(url), { signal })
    }
    return res
  } finally {
    release()
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
export async function fetchJson<T = unknown>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await dataFetch(url, signal)
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
