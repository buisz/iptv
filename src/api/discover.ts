/**
 * Bron-onderzoek (fase: wizard "ontdek wat een URL biedt").
 *
 * Je geeft één URL op; wij maken er een Source van, maken verbinding en rapporteren
 * wat er beschikbaar is — zodat je kunt kiezen wat je ermee wilt doen. Een Xtream-
 * `get.php`-link kan bijvoorbeeld zowel via de rijkere Xtream-API als als platte
 * M3U geladen worden.
 */
import type { M3uUrlSource, XtreamSource } from '../types/source'
import { detectSource } from './detect'
import { apiUrl } from './xtream'
import { parseM3U } from './m3u'
import { fetchJson, fetchText } from './proxy'

export interface XtreamProbe {
  source: XtreamSource
  status?: string
  expDate?: string
  maxConnections?: string
  activeConnections?: string
  liveCats?: number
  vodCats?: number
  seriesCats?: number
}

export interface M3uProbe {
  source: M3uUrlSource
  channels: number
  groups: number
  epgUrl?: string
}

export interface DiscoveryResult {
  /** Beschikbare manieren om deze URL te laden (één of beide). */
  xtream?: XtreamProbe
  m3u?: M3uProbe
  error?: string
}

interface XtreamAccount {
  user_info?: {
    auth?: number
    status?: string
    exp_date?: string | null
    max_connections?: string
    active_cons?: string
    message?: string
  }
}

async function probeXtream(s: XtreamSource, signal?: AbortSignal): Promise<XtreamProbe> {
  const account = await fetchJson<XtreamAccount>(apiUrl(s), signal)
  const info = account.user_info
  if (info && info.auth === 0) throw new Error(info.message || 'Login geweigerd.')

  // Categorie-aantallen als indicatie van wat er beschikbaar is (goedkoop).
  const count = async (action: string) =>
    fetchJson<unknown[]>(apiUrl(s, action), signal)
      .then((a) => (Array.isArray(a) ? a.length : 0))
      .catch(() => 0)
  const [liveCats, vodCats, seriesCats] = await Promise.all([
    count('get_live_categories'),
    count('get_vod_categories'),
    count('get_series_categories'),
  ])

  const exp = info?.exp_date
  const expDate =
    exp && exp !== 'null' ? new Date(Number(exp) * 1000).toLocaleDateString('nl-NL') : 'onbeperkt'

  return {
    source: s,
    status: info?.status,
    expDate,
    maxConnections: info?.max_connections,
    activeConnections: info?.active_cons,
    liveCats,
    vodCats,
    seriesCats,
  }
}

async function probeM3u(src: M3uUrlSource, signal?: AbortSignal): Promise<M3uProbe> {
  const text = await fetchText(src.url, signal)
  const playlist = parseM3U(text)
  const groups = new Set(playlist.tracks.map((t) => t.group || 'Overig'))
  return {
    source: src,
    channels: playlist.tracks.length,
    groups: groups.size,
    epgUrl: playlist.epgUrl,
  }
}

/** Onderzoekt een URL en geeft de mogelijke laad-opties terug. */
export async function discoverSource(input: string, signal?: AbortSignal): Promise<DiscoveryResult> {
  const detected = detectSource(input)
  if (!detected) return { error: 'Geen geldige link herkend (gebruik een volledige http(s)-URL).' }

  const result: DiscoveryResult = {}
  const src = detected.source

  try {
    if (src.kind === 'xtream') {
      result.xtream = await probeXtream(src, signal)
      // Een Xtream get.php-link kan óók als platte M3U; bied dat als alternatief.
      if (/get\.php/i.test(input)) {
        try {
          result.m3u = await probeM3u({ kind: 'm3u-url', url: input.trim() }, signal)
        } catch {
          /* M3U-variant optioneel */
        }
      }
    } else if (src.kind === 'm3u-url') {
      result.m3u = await probeM3u(src, signal)
    }
  } catch (err) {
    result.error = (err as Error).message || 'Onderzoek mislukt.'
  }

  if (!result.xtream && !result.m3u && !result.error) {
    result.error = 'Niets gevonden op deze URL.'
  }
  return result
}
