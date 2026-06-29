/**
 * Gedeelde content-typen.
 *
 * Deze vorm is bewust bron-agnostisch: in fase 2 mappen zowel de Xtream-client
 * als de M3U-parser hun ruwe data naar deze typen, zodat de UI-laag onveranderd
 * blijft. In fase 1 worden ze gevuld door src/data/mockContent.ts.
 */

export type MediaKind = 'live' | 'movie' | 'series'

export interface Episode {
  id: string
  title: string
  episodeNumber: number
  seasonNumber: number
  durationMin: number
  synopsis: string
  still?: string
}

export interface MediaItem {
  id: string
  kind: MediaKind
  title: string
  /** Korte tagline of, voor live, de huidige uitzending. */
  tagline?: string
  synopsis: string
  /** Staand poster-beeld (2:3). */
  poster: string
  /** Liggend sfeerbeeld (16:9) voor hero en detail. */
  backdrop: string
  /** Logo-tekst of zenderafkorting voor live-kanalen. */
  channelBadge?: string
  year?: number
  /** Leeftijdsindicatie, bijv. "12", "16". */
  rating?: string
  /** 0–10, TMDB-stijl. */
  score?: number
  durationMin?: number
  genres: string[]
  cast?: string[]
  /** Voortgang 0–1 voor de "Verder kijken"-rij. */
  progress?: number
  /** Live: loopt er nu iets? */
  isLiveNow?: boolean
  /** Series: seizoenen → afleveringen. */
  seasons?: { seasonNumber: number; episodes: Episode[] }[]
}

export interface ContentRowData {
  id: string
  title: string
  items: MediaItem[]
  /** Toon een dunne voortgangsbalk onder elke poster (Verder kijken). */
  showProgress?: boolean
}

export interface CatalogSection {
  /** Navigatielabel, bijv. "Home", "Live TV", "Films", "Series". */
  key: string
  label: string
  rows: ContentRowData[]
}
