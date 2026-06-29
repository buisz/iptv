/**
 * TMDB-metadataverrijking (fase 2, optioneel).
 *
 * Veel M3U/Xtream-bronnen leveren kale titels zonder poster, omschrijving of
 * cast. Met een (gratis) TMDB-API-sleutel kunnen we die metadata bijzoeken op
 * titel + jaar. De sleutel is optioneel: zonder sleutel slaat de app dit over en
 * gebruikt de provider-beelden.
 *
 * Verrijking gebeurt lui — pas wanneer een item-detail wordt geopend — om het
 * aantal API-aanvragen klein te houden.
 */
import type { MediaItem } from '../types/content'
import { fetchJson } from './proxy'

const IMG = 'https://image.tmdb.org/t/p'

interface TmdbSearchResult {
  id: number
  media_type?: 'movie' | 'tv' | 'person'
  title?: string
  name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  vote_average?: number
  release_date?: string
  first_air_date?: string
  genre_ids?: number[]
}

interface TmdbCredits {
  cast?: { name: string }[]
}

interface TmdbDetails {
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  vote_average?: number
  genres?: { name: string }[]
  credits?: TmdbCredits
  release_date?: string
  first_air_date?: string
  runtime?: number
  episode_run_time?: number[]
}

const STORAGE_KEY = 'buisz.tmdbKey'

export function getTmdbKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setTmdbKey(key: string | null): void {
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* localStorage niet beschikbaar — negeer */
  }
}

/** Verwijdert provider-ruis uit titels (jaartal, kwaliteitslabels, taalcodes). */
function cleanTitle(title: string): { query: string; year?: number } {
  const yearMatch = title.match(/\b(19|20)\d{2}\b/)
  const year = yearMatch ? Number(yearMatch[0]) : undefined
  const query = title
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/\b(4k|uhd|fhd|hd|sd|hevc|h\.?265|multi|vo|vostfr|nl|en)\b/gi, '')
    .replace(/[[\](){}|].*?[[\](){}|]/g, '')
    .replace(/[._]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return { query, year }
}

/**
 * Zoekt metadata bij een item en geeft een verrijkte kopie terug. Bij geen
 * sleutel, geen treffer of een fout wordt het originele item ongewijzigd
 * teruggegeven (verrijking is best-effort).
 */
export async function enrichItem(
  item: MediaItem,
  signal?: AbortSignal,
): Promise<MediaItem> {
  const key = getTmdbKey()
  if (!key || item.enriched || item.kind === 'live') return item

  try {
    const { query, year } = cleanTitle(item.title)
    if (!query) return { ...item, enriched: true }

    const type = item.kind === 'series' ? 'tv' : 'movie'
    const search = await fetchJson<{ results?: TmdbSearchResult[] }>(
      `https://api.themoviedb.org/3/search/${type}?api_key=${key}` +
        `&query=${encodeURIComponent(query)}${year ? `&year=${year}` : ''}`,
      signal,
    )
    const hit = search.results?.[0]
    if (!hit) return { ...item, enriched: true }

    const details = await fetchJson<TmdbDetails>(
      `https://api.themoviedb.org/3/${type}/${hit.id}?api_key=${key}&append_to_response=credits`,
      signal,
    )

    const runtime = details.runtime ?? details.episode_run_time?.[0]
    const date = details.release_date ?? details.first_air_date
    const y = date ? Number(date.slice(0, 4)) : item.year

    return {
      ...item,
      synopsis: details.overview || item.synopsis,
      poster: details.poster_path ? `${IMG}/w500${details.poster_path}` : item.poster,
      backdrop: details.backdrop_path ? `${IMG}/w1280${details.backdrop_path}` : item.backdrop,
      score: details.vote_average ? Math.round(details.vote_average * 10) / 10 : item.score,
      year: y || item.year,
      durationMin: runtime || item.durationMin,
      genres: details.genres?.length ? details.genres.map((g) => g.name).slice(0, 4) : item.genres,
      cast: details.credits?.cast?.length
        ? details.credits.cast.slice(0, 8).map((c) => c.name)
        : item.cast,
      enriched: true,
    }
  } catch {
    // Verrijking is optioneel — val stil terug op het origineel.
    return { ...item, enriched: true }
  }
}
