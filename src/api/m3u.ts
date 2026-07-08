/**
 * M3U / M3U_plus-parser (fase 2).
 *
 * Leest `#EXTINF`-regels met attributen (tvg-id, tvg-name, tvg-logo,
 * group-title) gevolgd door de stream-URL op de volgende regel. Ondersteunt
 * zowel een losse M3U-URL, een geüpload bestand, als M3U_plus. Optioneel wordt
 * `x-tvg-url` (XMLTV-EPG) uit de kopregel gehaald.
 */
import type { Catalog, ContentRowData, MediaItem, MediaKind } from '../types/content'
import type { M3uTextSource, M3uUrlSource } from '../types/source'
import { fetchText } from './proxy'
import { qualityFromName } from './quality'

export interface M3uTrack {
  name: string
  url: string
  tvgId?: string
  tvgName?: string
  tvgLogo?: string
  group?: string
}

export interface M3uPlaylist {
  tracks: M3uTrack[]
  epgUrl?: string
}

const ATTR_RE = /([a-zA-Z0-9-]+)="([^"]*)"/g

/** Parseert rauwe M3U-tekst naar tracks + optionele EPG-URL. */
export function parseM3U(text: string): M3uPlaylist {
  const lines = text.split(/\r?\n/)
  const tracks: M3uTrack[] = []
  let epgUrl: string | undefined
  let pending: Omit<M3uTrack, 'url'> | null = null

  for (let raw of lines) {
    const line = raw.trim()
    if (!line) continue

    if (line.startsWith('#EXTM3U')) {
      const m = line.match(/(?:x-tvg-url|url-tvg)="?([^"\s]+)"?/i)
      if (m) epgUrl = m[1]
      continue
    }

    if (line.startsWith('#EXTINF')) {
      const attrs: Record<string, string> = {}
      let match: RegExpExecArray | null
      ATTR_RE.lastIndex = 0
      while ((match = ATTR_RE.exec(line)) !== null) {
        attrs[match[1].toLowerCase()] = match[2]
      }
      // De weergavenaam staat na de laatste komma.
      const comma = line.lastIndexOf(',')
      const name = comma >= 0 ? line.slice(comma + 1).trim() : ''
      pending = {
        name: name || attrs['tvg-name'] || 'Naamloos',
        tvgId: attrs['tvg-id'] || undefined,
        tvgName: attrs['tvg-name'] || undefined,
        tvgLogo: attrs['tvg-logo'] || undefined,
        group: attrs['group-title'] || undefined,
      }
      continue
    }

    // Niet-EXTINF commentaarregels (#EXTGRP etc.) overslaan.
    if (line.startsWith('#')) {
      if (pending && line.startsWith('#EXTGRP:')) {
        pending.group = line.slice('#EXTGRP:'.length).trim() || pending.group
      }
      continue
    }

    // Een URL-regel: koppel aan de laatste #EXTINF (of sta losse URL toe).
    if (pending) {
      tracks.push({ ...pending, url: line })
      pending = null
    } else {
      tracks.push({ name: line.split('/').pop() || line, url: line })
    }
  }

  return { tracks, epgUrl }
}

// ── Classificatie & mapping ──────────────────────────────────────────────────

const SERIES_HINT = /(serie|seizoen|season|s\d{1,2}\s?e\d{1,2})/i
const VOD_HINT = /\/(movie|vod|movies|film)\//i

/** Bepaalt het mediatype op basis van URL en groepsnaam. */
function classify(track: M3uTrack): MediaKind {
  const url = track.url.toLowerCase()
  const group = (track.group ?? '').toLowerCase()

  if (url.includes('/series/') || SERIES_HINT.test(group)) return 'series'
  if (VOD_HINT.test(url) || /\.(mp4|mkv|avi)(\?|$)/.test(url) || /film|movie|vod/.test(group)) {
    return 'movie'
  }
  // Standaard: live (m3u8/ts of /live/ of onbekend).
  return 'live'
}

function badge(name: string): string {
  const cleaned = name.replace(/^[a-z]{2,3}\s*[:|]\s*/i, '')
  const parts = cleaned.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase()
}

function toMediaItem(track: M3uTrack, index: number, kind: MediaKind): MediaItem {
  const logo = track.tvgLogo || ''
  return {
    id: `m3u-${kind}-${index}`,
    kind,
    title: track.name,
    poster: logo,
    backdrop: logo,
    channelBadge: kind === 'live' ? badge(track.name) || undefined : undefined,
    genres: track.group ? [track.group] : [],
    isLiveNow: kind === 'live' ? true : undefined,
    streamUrl: track.url,
    epgChannelId: kind === 'live' ? track.tvgId : undefined,
    quality: qualityFromName(`${track.name} ${track.group ?? ''}`),
    synopsis: '',
  }
}

function rowsByGroup(items: MediaItem[]): ContentRowData[] {
  const byGroup = new Map<string, MediaItem[]>()
  for (const item of items) {
    const group = item.genres[0] || 'Overig'
    const list = byGroup.get(group) ?? []
    list.push(item)
    byGroup.set(group, list)
  }
  // Geen cap: alle groepen en items (lazy-loaded beeld/EPG).
  const rows: ContentRowData[] = []
  for (const [group, list] of byGroup) {
    rows.push({ id: `grp-${kindSafe(group)}`, title: group, items: list })
  }
  return rows
}

function kindSafe(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()
}

/** Bouwt een Catalog uit een geparste playlist. */
export function playlistToCatalog(
  playlist: M3uPlaylist,
  sourceLabel: string,
): Catalog {
  const classified = playlist.tracks.map((t) => ({ track: t, kind: classify(t) }))

  const live = classified.filter((c) => c.kind === 'live').map((c, i) => toMediaItem(c.track, i, 'live'))
  const movies = classified.filter((c) => c.kind === 'movie').map((c, i) => toMediaItem(c.track, i, 'movie'))
  const series = classified.filter((c) => c.kind === 'series').map((c, i) => toMediaItem(c.track, i, 'series'))

  const liveRows = rowsByGroup(live)
  const filmRows = rowsByGroup(movies)
  const serieRows = rowsByGroup(series)

  const sections = []
  const homeRows: ContentRowData[] = []
  if (liveRows[0]) homeRows.push({ ...liveRows[0], id: 'home-live', title: 'Live TV' })
  if (filmRows[0]) homeRows.push({ ...filmRows[0], id: 'home-films', title: 'Films' })
  if (serieRows[0]) homeRows.push({ ...serieRows[0], id: 'home-series', title: 'Series' })
  if (liveRows[1]) homeRows.push({ ...liveRows[1], id: 'home-live-2' })
  if (homeRows.length) sections.push({ key: 'home', label: 'Home', rows: homeRows })
  if (liveRows.length) sections.push({ key: 'live', label: 'Live TV', rows: liveRows })
  if (filmRows.length) sections.push({ key: 'films', label: 'Films', rows: filmRows })
  if (serieRows.length) sections.push({ key: 'series', label: 'Series', rows: serieRows })

  if (sections.length === 0) {
    throw new Error('Playlist geladen, maar geen afspeelbare items gevonden.')
  }

  const hero =
    movies.find((m) => m.poster) ??
    series.find((s) => s.poster) ??
    live.find((l) => l.poster) ??
    sections[0].rows[0].items[0]

  return {
    sections,
    hero,
    sourceLabel,
    epgUrl: playlist.epgUrl,
    allItems: [...live, ...movies, ...series],
  }
}

// ── Laders ───────────────────────────────────────────────────────────────────

export async function loadM3uUrlCatalog(src: M3uUrlSource, signal?: AbortSignal): Promise<Catalog> {
  const text = await fetchText(src.url, signal)
  const playlist = parseM3U(text)
  if (src.epgUrl) playlist.epgUrl = src.epgUrl
  let host = src.url
  try {
    host = new URL(src.url).host
  } catch {
    /* laat de volledige string staan */
  }
  return playlistToCatalog(playlist, `M3U · ${host}`)
}

export function loadM3uTextCatalog(src: M3uTextSource): Catalog {
  const playlist = parseM3U(src.text)
  return playlistToCatalog(playlist, `M3U-bestand${src.name ? ` · ${src.name}` : ''}`)
}
