/**
 * Lokale, persistente EPG-cache (per kanaal) in localStorage.
 *
 * Waarom: `get_short_epg` kost per kanaal een API-call. De in-memory cache verdween
 * bij een reload; deze cache overleeft reloads → minder calls, snellere weergave.
 *
 * Opslag: per kanaal ~0,5–1 KB JSON (± 8 programma's). We begrenzen op MAX_ENTRIES
 * kanalen (LRU op leeftijd) → ruwweg < 1 MB, ruim binnen de ~5 MB localStorage-limiet.
 * De programmering zelf verandert niet gedurende de dag; alleen "wat is nu" wordt bij
 * het renderen opnieuw bepaald. TTL dekt roostersaanpassingen af.
 */
import type { EpgEntry } from '../types/content'

const KEY = 'buisz.epgCache'
const TTL = 2 * 60 * 60 * 1000 // 2 uur
const MAX_ENTRIES = 800

interface Entry {
  at: number
  list: EpgEntry[]
}

let mem: Record<string, Entry> | null = null
let flushTimer: ReturnType<typeof setTimeout> | undefined

function load(): Record<string, Entry> {
  if (mem) return mem
  try {
    mem = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, Entry>
  } catch {
    mem = {}
  }
  return mem
}

/** Schrijven debouncen: bij een grid vullen veel kanalen tegelijk de cache. */
function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = undefined
    try {
      localStorage.setItem(KEY, JSON.stringify(mem))
    } catch {
      /* quota vol — laat het; MAX_ENTRIES houdt 't klein */
    }
  }, 1000)
}

export function getCachedEpg(key: string): EpgEntry[] | null {
  const m = load()
  const e = m[key]
  if (!e) return null
  if (Date.now() - e.at > TTL) {
    delete m[key]
    return null
  }
  return e.list
}

export function setCachedEpg(key: string, list: EpgEntry[]): void {
  if (!list.length) return
  const m = load()
  m[key] = { at: Date.now(), list }
  const keys = Object.keys(m)
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => m[a].at - m[b].at)
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((k) => delete m[k])
  }
  scheduleFlush()
}
