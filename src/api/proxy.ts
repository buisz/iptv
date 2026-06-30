/**
 * Routeert externe verzoeken via een CORS-proxy.
 *
 * - In dev: via de Vite-middleware op `/__proxy` (zie vite.config.ts).
 * - In productie (web): via `VITE_PROXY_BASE` indien gezet — bijv. `/__proxy`
 *   wanneer je achter `server/proxy.mjs` draait.
 * - Op de doel-box met native netwerklaag is er geen browser-CORS en kan
 *   `VITE_PROXY_BASE` leeg blijven; dan gaat het verkeer rechtstreeks.
 */
export function proxied(url: string): string {
  if (import.meta.env.DEV) {
    return `/__proxy?url=${encodeURIComponent(url)}`
  }
  const base = import.meta.env.VITE_PROXY_BASE
  if (base) {
    return `${base}?url=${encodeURIComponent(url)}`
  }
  // Anders: de ingestelde koppel-Worker biedt ook /proxy aan.
  const worker = workerProxyBase()
  if (worker) {
    return `${worker}/proxy?url=${encodeURIComponent(url)}`
  }
  return url
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
