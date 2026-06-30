/**
 * QR-koppeling (client) — praat met de Buisz koppel-Worker (zie worker/).
 *
 * De TV/box maakt een sessie, toont een QR naar de telefoonpagina, en polt tot de
 * telefoon een bron heeft ingediend. De Worker-URL is configureerbaar (build-env
 * `VITE_PAIR_BASE` of via Instellingen → lokaal bewaard).
 */
import type { Source } from '../types/source'

const STORAGE_KEY = 'buisz.pairBase'

/** Basis-URL van de koppel-Worker (zonder trailing slash), of leeg. */
export function pairBase(): string {
  const env = import.meta.env.VITE_PAIR_BASE
  if (env) return env.replace(/\/$/, '')
  try {
    return (localStorage.getItem(STORAGE_KEY) || '').replace(/\/$/, '')
  } catch {
    return ''
  }
}

export function setPairBase(url: string): void {
  try {
    const clean = url.trim().replace(/\/$/, '')
    if (clean) localStorage.setItem(STORAGE_KEY, clean)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* localStorage niet beschikbaar */
  }
}

export function pairConfigured(): boolean {
  return Boolean(pairBase())
}

export interface PairSession {
  code: string
  pairUrl: string
  expiresIn: number
}

export async function createSession(): Promise<PairSession> {
  const base = pairBase()
  if (!base) throw new Error('Geen koppel-service ingesteld (zie Instellingen).')
  const res = await fetch(`${base}/api/session`, { method: 'POST' })
  if (!res.ok) throw new Error('Sessie aanmaken mislukt.')
  return res.json() as Promise<PairSession>
}

/** Polt één keer; geeft de bron terug zodra de telefoon 'm heeft ingediend. */
export async function pollSession(code: string, signal?: AbortSignal): Promise<Source | null> {
  const base = pairBase()
  if (!base) return null
  const res = await fetch(`${base}/api/session/${code}`, { signal })
  if (res.status === 404) throw new Error('Code verlopen — vraag een nieuwe QR aan.')
  if (!res.ok) return null
  const data = (await res.json()) as { source?: Source; pending?: boolean }
  return data.source ?? null
}
