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
  /** Directe afspeel-URL (fase 2; bij demo afwezig). */
  streamUrl?: string
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

  // ── Fase 2: koppeling met echte bronnen ──
  /** Directe afspeel-URL (live/film). Bij series zit de URL per aflevering. */
  streamUrl?: string
  /** Provider-referentie voor lui naladen (bijv. Xtream series_id / vod_id). */
  ref?: { kind: 'xtream-series' | 'xtream-vod'; id: string | number }
  /** Of TMDB-verrijking al is toegepast op dit item. */
  enriched?: boolean

  // ── Fase 3: EPG (XMLTV) voor live-kanalen ──
  /** EPG-kanaal-id (Xtream `epg_channel_id` of M3U `tvg-id`). */
  epgChannelId?: string
  /** Programma dat nu loopt. */
  epgNow?: EpgEntry
  /** Eerstvolgende programma. */
  epgNext?: EpgEntry

  // ── Afspeelbaarheid: codec/resolutie-hint × device-capaciteit ──
  /**
   * Kwaliteit/codec van de stream. Voor Xtream-VOD kan dit accuraat uit de
   * metadata komen; voor live/M3U is het een heuristiek uit naam-hints.
   */
  quality?: QualityHint
}

/** Eén EPG-uitzending (tijden in ms sinds epoch). */
export interface EpgEntry {
  title: string
  start: number
  stop: number
}

/** Kwaliteit/codec-hint van een stream (uit metadata of naam-hints). */
export interface QualityHint {
  res?: 'sd' | 'hd' | 'fhd' | '4k'
  codec?: 'h264' | 'hevc' | 'av1'
  /**
   * Herkomst van de hint. `meta` = uit provider-metadata (betrouwbaar, bijv.
   * Xtream VOD `get_vod_info`). `name` = afgeleid uit de stream-/kanaalnaam
   * (heuristiek; codec staat zelden in de naam, resolutie vaker).
   */
  from?: 'meta' | 'name'
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

/** Volledig geladen catalogus zoals de UI die consumeert. */
export interface Catalog {
  sections: CatalogSection[]
  hero: MediaItem
  /** Korte herkomstomschrijving voor de UI, bijv. "Xtream · host". */
  sourceLabel: string
  /** Optionele XMLTV-EPG-URL (M3U `x-tvg-url` of Xtream). */
  epgUrl?: string
  /** Niet-fatale meldingen, bijv. afgekapte rijen of overgeslagen items. */
  notices?: string[]
}
