/**
 * Favorieten / "Mijn lijst" — lokaal per toestel (geen account/sync).
 *
 * Net als gangbare IPTV-apps bewaren we dit puur in localStorage. We slaan genoeg
 * op om een PosterCard te tonen en het item opnieuw te openen.
 */
import type { MediaItem } from '../types/content'

const STORAGE_KEY = 'buisz.favorites'

interface FavEntry {
  item: MediaItem
  addedAt: number
}

function readAll(): Record<string, FavEntry> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, FavEntry>
  } catch {
    return {}
  }
}

function writeAll(map: Record<string, FavEntry>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* localStorage niet beschikbaar */
  }
}

export function isFavorite(id: string): boolean {
  return Boolean(readAll()[id])
}

/** Voegt toe of verwijdert; geeft de nieuwe staat terug (true = nu favoriet). */
export function toggleFavorite(item: MediaItem): boolean {
  const map = readAll()
  if (map[item.id]) {
    delete map[item.id]
    writeAll(map)
    return false
  }
  // Compacte kopie (geen seizoenen/afleveringen meeschrijven).
  const { seasons: _seasons, ...lite } = item
  void _seasons
  map[item.id] = { item: lite, addedAt: Date.now() }
  writeAll(map)
  return true
}

export function removeFavorite(id: string): void {
  const map = readAll()
  if (map[id]) {
    delete map[id]
    writeAll(map)
  }
}

export function clearFavorites(): void {
  writeAll({})
}

/** Favorieten als MediaItem[], nieuwste eerst. */
export function getFavorites(): MediaItem[] {
  return Object.values(readAll())
    .sort((a, b) => b.addedAt - a.addedAt)
    .map((e) => e.item)
}
