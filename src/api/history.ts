/**
 * Kijkgeschiedenis — "Onlangs bekeken" (lokaal).
 *
 * Anders dan `progress.ts` (alleen films/series mét voortgang, voor "Verder kijken")
 * onthoudt dit élke start van een afspeelactie, óók live-zenders. Zo kun je op Home
 * snel terug naar je laatst bekeken zenders/titels. Bewaard in localStorage, nieuwste
 * eerst, begrensd op MAX_ENTRIES.
 */
import type { MediaItem, MediaKind } from '../types/content'

const STORAGE_KEY = 'buisz.history'
const MAX_ENTRIES = 24

interface HistoryEntry {
  id: string
  kind: MediaKind
  title: string
  poster: string
  backdrop: string
  streamUrl?: string
  at: number
}

function readAll(): HistoryEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(v) ? (v as HistoryEntry[]) : []
  } catch {
    return []
  }
}

function writeAll(list: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* localStorage niet beschikbaar */
  }
}

export interface RecordWatchInput {
  id: string
  kind: MediaKind
  title: string
  poster?: string
  backdrop?: string
  streamUrl?: string
}

/** Leg een afspeelstart vast (nieuwste eerst, ontdubbeld op id). */
export function recordWatch(input: RecordWatchInput): void {
  if (!input.id) return
  const list = readAll().filter((e) => e.id !== input.id)
  list.unshift({
    id: input.id,
    kind: input.kind,
    title: input.title,
    poster: input.poster || '',
    backdrop: input.backdrop || '',
    streamUrl: input.streamUrl,
    at: Date.now(),
  })
  writeAll(list.slice(0, MAX_ENTRIES))
}

export function clearHistory(): void {
  writeAll([])
}

/** "Onlangs bekeken" als MediaItem[] (minimaal); nieuwste eerst. */
export function getRecentlyWatched(): MediaItem[] {
  return readAll().map((e) => ({
    id: e.id,
    kind: e.kind,
    title: e.title,
    poster: e.poster,
    backdrop: e.backdrop,
    streamUrl: e.streamUrl,
    genres: [],
    synopsis: '',
  }))
}
