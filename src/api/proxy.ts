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

/** Haal tekst op via de proxy met een nette foutmelding. */
export async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(proxied(url), { signal })
  if (!res.ok) {
    throw new Error(`Ophalen mislukt (${res.status}) voor ${shorten(url)}`)
  }
  return res.text()
}

/** Haal JSON op via de proxy. Xtream geeft soms tekst/HTML bij fouten — vang dat af. */
export async function fetchJson<T = unknown>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(proxied(url), { signal })
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
