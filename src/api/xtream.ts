/**
 * Xtream Codes API-client (fase 2).
 *
 * Praat met `player_api.php` en mapt de ruwe provider-data naar het
 * bron-agnostische MediaItem-model. Het live-stream-URL-formaat is
 * configureerbaar omdat providers daarin verschillen (en anders stil falen).
 *
 * Alle netwerkverkeer loopt in dev via de CORS-proxy (zie api/proxy.ts).
 */
import type { Catalog, ContentRowData, EpgEntry, MediaItem } from '../types/content'
import type { XtreamSource, LiveFormatPreset } from '../types/source'
import { fetchJson } from './proxy'
import { normalizeCodec, qualityFromName, resFromHeight } from './quality'
import { getCachedEpg, setCachedEpg } from './epgCache'

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
  // split/join i.p.v. String.replaceAll: laatste ontbreekt op oude TV-engines.
  const fill = (str: string, token: string, value: string) => str.split(token).join(value)
  let url = template
  url = fill(url, '{scheme}', scheme(s))
  url = fill(url, '{host}', s.host)
  url = fill(url, '{port}', String(port(s)))
  url = fill(url, '{username}', s.username)
  url = fill(url, '{password}', s.password)
  url = fill(url, '{id}', String(streamId))
  url = fill(url, '{ext}', 'ts')
  return url
}

export function vodStreamUrl(s: XtreamSource, streamId: string | number, ext = 'mp4'): string {
  return `${origin(s)}/movie/${s.username}/${s.password}/${streamId}.${ext}`
}

/** Volledige XMLTV-EPG van een Xtream-server (standaard-endpoint). */
export function xmltvUrl(s: XtreamSource): string {
  const params = new URLSearchParams({ username: s.username, password: s.password })
  return `${origin(s)}/xmltv.php?${params.toString()}`
}

interface XtreamShortEpgItem {
  title?: string
  start?: string
  end?: string
  start_timestamp?: string | number
  stop_timestamp?: string | number
}

/** Xtream-titels in get_short_epg zijn base64 (UTF-8). Veilig decoderen. */
function decodeB64(s?: string): string {
  if (!s) return ''
  try {
    return decodeURIComponent(escape(atob(s)))
  } catch {
    return s
  }
}

/**
 * Betrouwbare per-kanaal-EPG via `get_short_epg` (de provider lost het op via
 * stream_id — geen id/naam-matching nodig). Lokaal gecachet (localStorage, overleeft
 * reloads). Basis voor detail-nu/straks én de tijdlijn-weergave.
 */
export async function loadShortEpg(
  s: XtreamSource,
  streamId: string | number,
  limit = 12,
  signal?: AbortSignal,
): Promise<EpgEntry[]> {
  const key = `${s.host}:${s.username}:${streamId}`
  const cached = getCachedEpg(key)
  if (cached) return dedupeEpg(cached) // ook oude cache (van vóór de fix) opschonen

  const data = await fetchJson<{ epg_listings?: XtreamShortEpgItem[] }>(
    apiUrl(s, 'get_short_epg', { stream_id: streamId, limit }),
    signal,
    { background: true }, // zachte baan: geen retry-storm bij 429
  )
  const out: EpgEntry[] = []
  for (const e of data.epg_listings ?? []) {
    const start = Number(e.start_timestamp) * 1000 || Date.parse((e.start ?? '').replace(' ', 'T'))
    const stopRaw = Number(e.stop_timestamp) * 1000 || Date.parse((e.end ?? '').replace(' ', 'T'))
    if (!isFinite(start)) continue
    out.push({
      title: decodeB64(e.title) || 'Programma',
      start,
      stop: isFinite(stopRaw) ? stopRaw : start + 30 * 60_000,
    })
  }
  out.sort((a, b) => a.start - b.start || a.stop - b.stop)
  const clean = dedupeEpg(out)
  setCachedEpg(key, clean)
  return clean
}

/**
 * Sommige providers leveren via `get_short_epg` bijna-dubbele programma's: dezelfde
 * titel met licht verschoven tijden (bijv. 14:10–14:57, 14:15–15:00 én 14:20–15:00),
 * doordat ze twee EPG-bronnen samenvoegen. Zonder opschonen stapelen die op elkaar
 * in de gids. Regel: **zelfde titel + overlappende tijd = één blok** (we rekken op
 * tot de unie). Een marathon van dezelfde titel achter elkaar overlapt níet en
 * blijft dus als losse blokken staan. Invoer moet op start gesorteerd zijn.
 */
function dedupeEpg(list: EpgEntry[]): EpgEntry[] {
  const out: EpgEntry[] = []
  // Per titel het laatst behouden blok, om ook door tussenliggende andere titels
  // heen te ontdubbelen (bijv. A, kort nieuwsbulletin B, A' → A en A' samenvoegen).
  const lastByTitle = new Map<string, EpgEntry>()
  for (const p of list) {
    const k = normTitle(p.title)
    const prev = lastByTitle.get(k)
    if (prev && p.start < prev.stop) {
      // Overlap met eerder blok van dezelfde titel → samenvoegen (unie van de tijd).
      if (p.stop > prev.stop) prev.stop = p.stop
      continue
    }
    const entry = { ...p }
    out.push(entry)
    lastByTitle.set(k, entry)
  }
  return out
}

function normTitle(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function seriesStreamUrl(s: XtreamSource, episodeId: string | number, ext = 'mp4'): string {
  return `${origin(s)}/series/${s.username}/${s.password}/${episodeId}.${ext}`
}

// ── Mappers ─────────────────────────────────────────────────────────────────

function rating10(r?: number): number | undefined {
  return r != null && r > 0 ? Math.round(r * 2 * 10) / 10 : undefined
}

function badge(name: string): string {
  // Strip een land-prefix ("NL: ", "US|") zodat de initialen van de échte naam komen.
  const cleaned = name.replace(/^[a-z]{2,3}\s*[:|]\s*/i, '')
  const letters = cleaned.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\s+/)
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
    ref: { kind: 'xtream-live', id: c.stream_id },
    quality: qualityFromName(c.name),
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
    quality: qualityFromName(v.name),
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
): ContentRowData[] {
  const byCat = new Map<string, MediaItem[]>()
  for (const item of items) {
    const cat = rawCategoryId(item) ?? '__overig'
    const list = byCat.get(cat) ?? []
    list.push(item)
    byCat.set(cat, list)
  }

  // Geen cap meer: toon alle categorieën en alle items (lazy-loaded beeld/EPG).
  const rows: ContentRowData[] = []
  for (const cat of categories) {
    const list = byCat.get(cat.category_id)
    if (!list || list.length === 0) continue
    rows.push({ id: `cat-${cat.category_id}`, title: cat.category_name, items: list })
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

// ── VOD-info (lui geladen bij openen detail) → accurate codec/resolutie ───────

interface XtreamVodInfo {
  info?: {
    video?: {
      codec_name?: string
      height?: number | string
      width?: number | string
    }
    bitrate?: number
    duration_secs?: number
  }
}

/**
 * Haalt accurate codec/resolutie-metadata op voor één film via `get_vod_info`.
 * Dit is de plek waar we de codec écht weten (FFprobe-velden van de provider) —
 * resultaat krijgt `from: 'meta'` zodat de UI hier wél een hard oordeel mag geven.
 */
export async function loadVodQuality(
  s: XtreamSource,
  vodId: string | number,
  signal?: AbortSignal,
): Promise<MediaItem['quality'] | undefined> {
  const data = await fetchJson<XtreamVodInfo>(
    apiUrl(s, 'get_vod_info', { vod_id: vodId }),
    signal,
  )
  const video = data.info?.video
  if (!video) return undefined
  const codec = normalizeCodec(video.codec_name)
  const res = resFromHeight(Number(video.height))
  if (!codec && !res) return undefined
  return { codec, res, from: 'meta' }
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

type Pair = { item: MediaItem; cat?: string }

/** Bouwt de Catalog uit de tot dusver geladen live/films/series (mag leeg zijn). */
function assemble(s: XtreamSource, live: Pair[], vod: Pair[], series: Pair[], liveCats: XtreamCategory[], vodCats: XtreamCategory[], seriesCats: XtreamCategory[]): Catalog | null {
  const catOf = (pairs: Pair[]) => {
    const m = new Map<string, string | undefined>()
    for (const p of pairs) m.set(p.item.id, p.cat)
    return (item: MediaItem) => m.get(item.id)
  }
  const liveRows = buildRows(liveCats, live.map((p) => p.item), catOf(live))
  const vodRows = buildRows(vodCats, vod.map((p) => p.item), catOf(vod))
  const seriesRows = buildRows(seriesCats, series.map((p) => p.item), catOf(series))

  const sections = []
  const homeRows: ContentRowData[] = []
  if (vodRows[0]) homeRows.push({ ...vodRows[0], id: 'home-films', title: 'Films — uitgelicht' })
  if (seriesRows[0]) homeRows.push({ ...seriesRows[0], id: 'home-series', title: 'Series — uitgelicht' })
  if (liveRows[0]) homeRows.push({ ...liveRows[0], id: 'home-live', title: 'Live TV' })
  if (vodRows[1]) homeRows.push({ ...vodRows[1], id: 'home-films-2' })
  if (homeRows.length) sections.push({ key: 'home', label: 'Home', rows: homeRows })
  if (liveRows.length) sections.push({ key: 'live', label: 'TV', rows: liveRows })
  if (vodRows.length) sections.push({ key: 'films', label: 'Films', rows: vodRows })
  if (seriesRows.length) sections.push({ key: 'series', label: 'Series', rows: seriesRows })
  if (sections.length === 0) return null

  const hero =
    series.find((p) => p.item.backdrop && p.item.synopsis)?.item ??
    vod.find((p) => p.item.poster)?.item ??
    sections[0].rows[0].items[0]

  return {
    sections,
    hero,
    sourceLabel: `Xtream · ${s.host}`,
    epgUrl: xmltvUrl(s),
    allItems: [...live, ...vod, ...series].map((p) => p.item),
  }
}

export async function loadXtreamCatalog(
  s: XtreamSource,
  signal?: AbortSignal,
  onPartial?: (partial: Catalog) => void,
): Promise<Catalog> {
  // Verifieer eerst de inloggegevens via de account-info (geen action).
  const account = await fetchJson<{ user_info?: { auth?: number; message?: string } }>(apiUrl(s), signal)
  if (account.user_info && account.user_info.auth === 0) {
    throw new Error(account.user_info.message || 'Xtream-login geweigerd (controleer gegevens).')
  }

  // Categorieën eerst (klein). Daarna de drie grote stream-lijsten parallel; we tonen
  // elke sectie zodra hij binnen is i.p.v. te wachten op de volledige download.
  const [liveCats, vodCats, seriesCats] = await Promise.all([
    fetchJson<XtreamCategory[]>(apiUrl(s, 'get_live_categories'), signal).catch(() => []),
    fetchJson<XtreamCategory[]>(apiUrl(s, 'get_vod_categories'), signal).catch(() => []),
    fetchJson<XtreamCategory[]>(apiUrl(s, 'get_series_categories'), signal).catch(() => []),
  ])

  let live: Pair[] = []
  let vod: Pair[] = []
  let series: Pair[] = []
  const emit = () => {
    if (!onPartial) return
    const partial = assemble(s, live, vod, series, liveCats ?? [], vodCats ?? [], seriesCats ?? [])
    if (partial) onPartial(partial)
  }

  const liveP = fetchJson<XtreamLive[]>(apiUrl(s, 'get_live_streams'), signal)
    .then((raw) => {
      live = (raw ?? []).map((c) => ({ item: mapLive(s, c), cat: c.category_id }))
      emit()
    })
    .catch(() => {})
  const vodP = fetchJson<XtreamVod[]>(apiUrl(s, 'get_vod_streams'), signal)
    .then((raw) => {
      vod = (raw ?? []).map((v) => ({ item: mapVod(s, v), cat: v.category_id }))
      emit()
    })
    .catch(() => {})
  const seriesP = fetchJson<XtreamSeries[]>(apiUrl(s, 'get_series'), signal)
    .then((raw) => {
      series = (raw ?? []).map((v) => ({ item: mapSeries(v), cat: v.category_id }))
      emit()
    })
    .catch(() => {})

  await Promise.all([liveP, vodP, seriesP])

  const full = assemble(s, live, vod, series, liveCats ?? [], vodCats ?? [], seriesCats ?? [])
  if (!full) throw new Error('Xtream-account geladen, maar geen content gevonden.')
  return full
}
