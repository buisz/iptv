/**
 * "Verder kijken" — afspeelvoortgang lokaal bewaren (fase: app-features).
 *
 * Per bekeken item bewaren we genoeg om een PosterCard te tonen plus de positie
 * om te hervatten. Live-kanalen slaan we niet op (geen voortgang). Bewaard in
 * localStorage; verwijderen doet de gebruiker zelf (zie removeProgress).
 */
import type { MediaItem, MediaKind } from '../types/content'

const STORAGE_KEY = 'buisz.progress'
const MAX_ENTRIES = 24

export interface ProgressEntry {
  id: string
  kind: MediaKind
  title: string
  poster: string
  backdrop: string
  streamUrl?: string
  /** Voortgang 0–1. */
  fraction: number
  /** Positie in seconden om te hervatten. */
  positionSec: number
  durationSec: number
  updatedAt: number
}

function readAll(): Record<string, ProgressEntry> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, ProgressEntry>
  } catch {
    return {}
  }
}

function writeAll(map: Record<string, ProgressEntry>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* localStorage niet beschikbaar */
  }
}

export interface SaveProgressInput {
  id: string
  kind: MediaKind
  title: string
  poster?: string
  backdrop?: string
  streamUrl?: string
  positionSec: number
  durationSec: number
}

/** Bewaar (of verwijder bij ~afgelopen) de voortgang van één item. */
export function saveProgress(input: SaveProgressInput): void {
  if (input.kind === 'live' || !input.durationSec || !isFinite(input.durationSec)) return
  const fraction = input.positionSec / input.durationSec
  const map = readAll()

  // Bijna klaar of nog niet echt begonnen → niet in "Verder kijken".
  if (fraction >= 0.95 || fraction < 0.02) {
    delete map[input.id]
    writeAll(map)
    return
  }

  map[input.id] = {
    id: input.id,
    kind: input.kind,
    title: input.title,
    poster: input.poster || '',
    backdrop: input.backdrop || '',
    streamUrl: input.streamUrl,
    fraction,
    positionSec: input.positionSec,
    durationSec: input.durationSec,
    updatedAt: Date.now(),
  }

  // Begrens en houd de meest recente.
  const entries = Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt)
  if (entries.length > MAX_ENTRIES) {
    const trimmed: Record<string, ProgressEntry> = {}
    for (const e of entries.slice(0, MAX_ENTRIES)) trimmed[e.id] = e
    writeAll(trimmed)
  } else {
    writeAll(map)
  }
}

export function removeProgress(id: string): void {
  const map = readAll()
  if (map[id]) {
    delete map[id]
    writeAll(map)
  }
}

/** Hervatpositie (seconden) voor een item, of undefined. */
export function resumePosition(id: string): number | undefined {
  return readAll()[id]?.positionSec
}

/** "Verder kijken"-items als MediaItem[], nieuwste eerst. */
export function getContinueWatching(): MediaItem[] {
  return Object.values(readAll())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      title: e.title,
      poster: e.poster,
      backdrop: e.backdrop,
      streamUrl: e.streamUrl,
      genres: [],
      synopsis: '',
      progress: e.fraction,
    }))
}
