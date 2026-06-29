/**
 * Routeert externe verzoeken in dev via de lokale CORS-proxy (zie vite.config.ts).
 *
 * In productie (verpakte box-app) is er geen browser-CORS-restrictie en gaat het
 * verkeer rechtstreeks. Daarom wordt alleen in dev herschreven.
 */
export function proxied(url: string): string {
  if (import.meta.env.DEV) {
    return `/__proxy?url=${encodeURIComponent(url)}`
  }
  return url
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
