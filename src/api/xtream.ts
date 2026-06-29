/**
 * Xtream Codes API-client (fase 2).
 *
 * Praat met `player_api.php` en mapt de ruwe provider-data naar het
 * bron-agnostische MediaItem-model. Het live-stream-URL-formaat is
 * configureerbaar omdat providers daarin verschillen (en anders stil falen).
 *
 * Alle netwerkverkeer loopt in dev via de CORS-proxy (zie api/proxy.ts).
 */
import type { Catalog, ContentRowData, MediaItem } from '../types/content'
import type { XtreamSource, LiveFormatPreset } from '../types/source'
import { fetchJson } from './proxy'

// ── Limieten zodat zeer grote playlists de UI niet verstikken. ──
const MAX_ROWS_PER_SECTION = 40
const MAX_ITEMS_PER_ROW = 40

// ── Ruwe Xtream-vormen (defensief getypeerd; providers wijken af). ──
interface XtreamCategory {
  category_id: string
  category_name: string
}
interface XtreamLive {
  stream_id: number | string
  name: string
  stream_icon?: string
  category_id?: string
  epg_channel_id?: string | null
}
interface XtreamVod {
  stream_id: number | string
  name: string
  stream_icon?: string
  category_id?: string
  rating_5based?: number
  container_extension?: string
  added?: string
}
interface XtreamSeries {
  series_id: number | string
  name: string
  cover?: string
  plot?: string
  cast?: string
  genre?: string
  rating_5based?: number
  releaseDate?: string
  category_id?: string
  backdrop_path?: string[]
}

// ── URL-opbouw ──────────────────────────────────────────────────────────────

function scheme(s: XtreamSource): string {
  return s.secure ? 'https' : 'http'
}

function port(s: XtreamSource): number {
  return s.port ?? (s.secure ? 443 : 80)
}

function origin(s: XtreamSource): string {
  return `${scheme(s)}://${s.host}:${port(s)}`
}

/** Basis-URL van player_api.php met inloggegevens en een optionele actie. */
export function apiUrl(s: XtreamSource, action?: string, extra?: Record<string, string | number>): string {
  const params = new URLSearchParams({ username: s.username, password: s.password })
  if (action) params.set('action', action)
  for (const [k, v] of Object.entries(extra ?? {})) params.set(k, String(v))
  return `${origin(s)}/player_api.php?${params.toString()}`
}

const LIVE_PRESETS: Record<Exclude<LiveFormatPreset, 'custom'>, string> = {
  ts: '{scheme}://{host}:{port}/live/{username}/{password}/{id}.ts',
  m3u8: '{scheme}://{host}:{port}/live/{username}/{password}/{id}.m3u8',
  'mpegts-noext': '{scheme}://{host}:{port}/{username}/{password}/{id}',
}

/** Bouwt de live-stream-URL volgens de gekozen preset of custom template. */
export function liveStreamUrl(s: XtreamSource, streamId: string | number): string {
  const preset = s.liveFormat ?? 'ts'
  const template =
    preset === 'custom' ? (s.liveTemplate ?? LIVE_PRESETS.ts) : LIVE_PRESETS[preset]
  return template
    .replaceAll('{scheme}', scheme(s))
    .replaceAll('{host}', s.host)
    .replaceAll('{port}', String(port(s)))
    .replaceAll('{username}', s.username)
    .replaceAll('{password}', s.password)
    .replaceAll('{id}', String(streamId))
    .replaceAll('{ext}', 'ts')
}

export function vodStreamUrl(s: XtreamSource, streamId: string | number, ext = 'mp4'): string {
  return `${origin(s)}/movie/${s.username}/${s.password}/${streamId}.${ext}`
}

export function seriesStreamUrl(s: XtreamSource, episodeId: string | number, ext = 'mp4'): string {
  return `${origin(s)}/series/${s.username}/${s.password}/${episodeId}.${ext}`
}

// ── Mappers ─────────────────────────────────────────────────────────────────

function rating10(r?: number): number | undefined {
  return r != null && r > 0 ? Math.round(r * 2 * 10) / 10 : undefined
}

function badge(name: string): string {
  const letters = name.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\s+/)
  return (letters[0]?.[0] ?? '') + (letters[1]?.[0] ?? letters[0]?.[1] ?? '')
}

function mapLive(s: XtreamSource, c: XtreamLive): MediaItem {
  const icon = c.stream_icon || ''
  return {
    id: `live-${c.stream_id}`,
    kind: 'live',
    title: c.name,
    poster: icon,
    backdrop: icon,
    channelBadge: badge(c.name).toUpperCase() || undefined,
    genres: [],
    isLiveNow: true,
    streamUrl: liveStreamUrl(s, c.stream_id),
    epgChannelId: c.epg_channel_id || undefined,
    synopsis: '',
  }
}

function mapVod(s: XtreamSource, v: XtreamVod): MediaItem {
  const icon = v.stream_icon || ''
  return {
    id: `vod-${v.stream_id}`,
    kind: 'movie',
    title: v.name,
    poster: icon,
    backdrop: icon,
    score: rating10(v.rating_5based),
    year: yearFrom(v.added),
    genres: [],
    streamUrl: vodStreamUrl(s, v.stream_id, v.container_extension || 'mp4'),
    ref: { kind: 'xtream-vod', id: v.stream_id },
    synopsis: '',
  }
}

function mapSeries(v: XtreamSeries): MediaItem {
  const cover = v.cover || ''
  return {
    id: `series-${v.series_id}`,
    kind: 'series',
    title: v.name,
    poster: cover,
    backdrop: v.backdrop_path?.[0] || cover,
    synopsis: v.plot || '',
    score: rating10(v.rating_5based),
    year: yearFrom(v.releaseDate),
    genres: (v.genre ?? '').split(/[,/]/).map((g) => g.trim()).filter(Boolean).slice(0, 4),
    cast: (v.cast ?? '').split(',').map((c) => c.trim()).filter(Boolean).slice(0, 8),
    ref: { kind: 'xtream-series', id: v.series_id },
  }
}

function yearFrom(value?: string): number | undefined {
  if (!value) return undefined
  const m = value.match(/(\d{4})/)
  const y = m ? Number(m[1]) : NaN
  return y >= 1900 && y <= 2100 ? y : undefined
}

// ── Rij-opbouw per categorie ─────────────────────────────────────────────────

function buildRows(
  categories: XtreamCategory[],
  items: MediaItem[],
  rawCategoryId: (item: MediaItem) => string | undefined,
  notices: string[],
  sectionLabel: string,
): ContentRowData[] {
  const byCat = new Map<string, MediaItem[]>()
  for (const item of items) {
    const cat = rawCategoryId(item) ?? '__overig'
    const list = byCat.get(cat) ?? []
    list.push(item)
    byCat.set(cat, list)
  }

  const rows: ContentRowData[] = []
  for (const cat of categories) {
    const list = byCat.get(cat.category_id)
    if (!list || list.length === 0) continue
    if (list.length > MAX_ITEMS_PER_ROW) {
      notices.push(`${sectionLabel} · "${cat.category_name}" afgekapt tot ${MAX_ITEMS_PER_ROW} items.`)
    }
    rows.push({
      id: `cat-${cat.category_id}`,
      title: cat.category_name,
      items: list.slice(0, MAX_ITEMS_PER_ROW),
    })
    if (rows.length >= MAX_ROWS_PER_SECTION) {
      notices.push(`${sectionLabel}: alleen de eerste ${MAX_ROWS_PER_SECTION} categorieën getoond.`)
      break
    }
  }
  return rows
}

// ── Series-info (lui geladen bij openen detail) ──────────────────────────────

interface XtreamSeriesInfoEpisode {
  id: string | number
  title?: string
  episode_num?: number | string
  container_extension?: string
  info?: { plot?: string; duration_secs?: number; duration?: string }
}

/** Vult seizoenen/afleveringen aan voor één serie via get_series_info. */
export async function loadSeriesInfo(
  s: XtreamSource,
  seriesId: string | number,
  signal?: AbortSignal,
): Promise<MediaItem['seasons']> {
  const data = await fetchJson<{ episodes?: Record<string, XtreamSeriesInfoEpisode[]> }>(
    apiUrl(s, 'get_series_info', { series_id: seriesId }),
    signal,
  )
  const episodesBySeason = data.episodes ?? {}
  const seasons: NonNullable<MediaItem['seasons']> = []
  for (const [seasonKey, eps] of Object.entries(episodesBySeason)) {
    const seasonNumber = Number(seasonKey) || 1
    seasons.push({
      seasonNumber,
      episodes: eps.map((ep, i) => ({
        id: String(ep.id),
        title: ep.title || `Aflevering ${ep.episode_num ?? i + 1}`,
        episodeNumber: Number(ep.episode_num) || i + 1,
        seasonNumber,
        durationMin: Math.round((ep.info?.duration_secs ?? 0) / 60) || 0,
        synopsis: ep.info?.plot ?? '',
        still: undefined,
        streamUrl: seriesStreamUrl(s, ep.id, ep.container_extension || 'mp4'),
      })),
    })
  }
  return seasons.sort((a, b) => a.seasonNumber - b.seasonNumber)
}

/** Geeft de afspeel-URL voor één serie-aflevering. */
export function episodeStreamUrl(
  s: XtreamSource,
  episodeId: string | number,
  ext = 'mp4',
): string {
  return seriesStreamUrl(s, episodeId, ext)
}

// ── Hoofdlader ───────────────────────────────────────────────────────────────

export async function loadXtreamCatalog(s: XtreamSource, signal?: AbortSignal): Promise<Catalog> {
  // Verifieer eerst de inloggegevens via de account-info (geen action).
  const account = await fetchJson<{ user_info?: { auth?: number; message?: string } }>(
    apiUrl(s),
    signal,
  )
  if (account.user_info && account.user_info.auth === 0) {
    throw new Error(account.user_info.message || 'Xtream-login geweigerd (controleer gegevens).')
  }

  const notices: string[] = []

  const [liveCats, vodCats, seriesCats, liveRaw, vodRaw, seriesRaw] = await Promise.all([
    fetchJson<XtreamCategory[]>(apiUrl(s, 'get_live_categories'), signal).catch(() => []),
    fetchJson<XtreamCategory[]>(apiUrl(s, 'get_vod_categories'), signal).catch(() => []),
    fetchJson<XtreamCategory[]>(apiUrl(s, 'get_series_categories'), signal).catch(() => []),
    fetchJson<XtreamLive[]>(apiUrl(s, 'get_live_streams'), signal).catch(() => []),
    fetchJson<XtreamVod[]>(apiUrl(s, 'get_vod_streams'), signal).catch(() => []),
    fetchJson<XtreamSeries[]>(apiUrl(s, 'get_series'), signal).catch(() => []),
  ])

  const live = (liveRaw ?? []).map((c) => ({ item: mapLive(s, c), cat: c.category_id }))
  const vod = (vodRaw ?? []).map((v) => ({ item: mapVod(s, v), cat: v.category_id }))
  const series = (seriesRaw ?? []).map((v) => ({ item: mapSeries(v), cat: v.category_id }))

  const catOf = (pairs: { item: MediaItem; cat?: string }[]) => {
    const m = new Map<string, string | undefined>()
    for (const p of pairs) m.set(p.item.id, p.cat)
    return (item: MediaItem) => m.get(item.id)
  }

  const liveRows = buildRows(liveCats ?? [], live.map((p) => p.item), catOf(live), notices, 'Live TV')
  const vodRows = buildRows(vodCats ?? [], vod.map((p) => p.item), catOf(vod), notices, 'Films')
  const seriesRows = buildRows(seriesCats ?? [], series.map((p) => p.item), catOf(series), notices, 'Series')

  const sections = []
  // Home: een greep uit elk type.
  const homeRows: ContentRowData[] = []
  if (vodRows[0]) homeRows.push({ ...vodRows[0], id: 'home-films', title: 'Films — uitgelicht' })
  if (seriesRows[0]) homeRows.push({ ...seriesRows[0], id: 'home-series', title: 'Series — uitgelicht' })
  if (liveRows[0]) homeRows.push({ ...liveRows[0], id: 'home-live', title: 'Live TV' })
  if (vodRows[1]) homeRows.push({ ...vodRows[1], id: 'home-films-2' })
  if (homeRows.length) sections.push({ key: 'home', label: 'Home', rows: homeRows })
  if (liveRows.length) sections.push({ key: 'live', label: 'Live TV', rows: liveRows })
  if (vodRows.length) sections.push({ key: 'films', label: 'Films', rows: vodRows })
  if (seriesRows.length) sections.push({ key: 'series', label: 'Series', rows: seriesRows })

  if (sections.length === 0) {
    throw new Error('Xtream-account geladen, maar geen content gevonden.')
  }

  // Hero: liefst een serie/film mét beeld en omschrijving.
  const hero =
    series.find((p) => p.item.backdrop && p.item.synopsis)?.item ??
    vod.find((p) => p.item.poster)?.item ??
    sections[0].rows[0].items[0]

  return {
    sections,
    hero,
    sourceLabel: `Xtream · ${s.host}`,
    notices: notices.length ? notices : undefined,
  }
}
