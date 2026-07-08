/**
 * XMLTV-EPG (fase 3).
 *
 * Leest een XMLTV-bron (`x-tvg-url` uit de M3U, of een aparte EPG-URL) en bepaalt
 * per kanaal het "nu" en "straks". Regex-gebaseerd zodat het zonder DOM werkt
 * (ook in tests) en geen zware XML-parser nodig is.
 *
 * Let op: EPG-bestanden kunnen groot zijn. We begrenzen de hoeveelheid en parsen
 * op de client; in productie hoort dit idealiter in een worker of backend.
 */
import type { Catalog, EpgEntry, MediaItem } from '../types/content'
import { fetchText } from './proxy'

/** Maximale EPG-grootte die we op de client verwerken (≈12 MB). */
const MAX_EPG_BYTES = 12 * 1024 * 1024

const PROGRAMME_RE = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g
const TITLE_RE = /<title\b[^>]*>([\s\S]*?)<\/title>/
const ATTR_START = /\bstart="([^"]+)"/
const ATTR_STOP = /\bstop="([^"]+)"/
const ATTR_CHANNEL = /\bchannel="([^"]+)"/

export type EpgIndex = Map<string, EpgEntry[]>

/**
 * XMLTV-tijd → ms. Formaat: `YYYYMMDDHHMMSS` met optionele zone `+0000`.
 * Geeft NaN bij onleesbare invoer.
 */
export function parseXmltvTime(value: string): number {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/)
  if (!m) return NaN
  const [, y, mo, d, h, mi, s, tz] = m
  const iso =
    `${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}` +
    (tz ? `${tz.slice(0, 3)}:${tz.slice(3)}` : 'Z')
  return Date.parse(iso)
}

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

/** Parseert XMLTV-tekst naar een index van kanaal-id → gesorteerde uitzendingen. */
export function parseXmltv(text: string): EpgIndex {
  const index: EpgIndex = new Map()
  let match: RegExpExecArray | null
  PROGRAMME_RE.lastIndex = 0

  while ((match = PROGRAMME_RE.exec(text)) !== null) {
    const attrs = match[1]
    const body = match[2]
    const channel = attrs.match(ATTR_CHANNEL)?.[1]
    const startRaw = attrs.match(ATTR_START)?.[1]
    if (!channel || !startRaw) continue

    const start = parseXmltvTime(startRaw)
    const stopRaw = attrs.match(ATTR_STOP)?.[1]
    const stop = stopRaw ? parseXmltvTime(stopRaw) : start + 30 * 60_000
    if (Number.isNaN(start)) continue

    const title = decodeEntities(body.match(TITLE_RE)?.[1] ?? '') || 'Programma'
    // Normaliseer de kanaal-id (kleine letters, geen randspaties): providers wijken af
    // in casing tussen de XMLTV-`channel` en de stream-`tvg-id`/`epg_channel_id`.
    const key = channel.toLowerCase().trim()
    const list = index.get(key) ?? []
    list.push({ title, start, stop })
    index.set(key, list)
  }

  for (const list of index.values()) list.sort((a, b) => a.start - b.start)
  return index
}

/** Bepaalt het lopende en eerstvolgende programma op tijdstip `at`. */
export function nowNext(
  programmes: EpgEntry[] | undefined,
  at: number,
): { now?: EpgEntry; next?: EpgEntry } {
  if (!programmes || programmes.length === 0) return {}
  let now: EpgEntry | undefined
  let next: EpgEntry | undefined
  for (const p of programmes) {
    if (p.start <= at && at < p.stop) now = p
    else if (p.start > at) {
      next = p
      break
    }
  }
  return { now, next }
}

/** Verrijkt live-items in een catalogus met nu/straks uit de EPG-index. */
export function applyEpg(catalog: Catalog, index: EpgIndex, at: number): Catalog {
  if (index.size === 0) return catalog

  const enrich = (item: MediaItem): MediaItem => {
    if (item.kind !== 'live' || !item.epgChannelId) return item
    const { now, next } = nowNext(index.get(item.epgChannelId.toLowerCase().trim()), at)
    if (!now && !next) return item
    return {
      ...item,
      epgNow: now,
      epgNext: next,
      tagline: now ? `Nu: ${now.title}` : item.tagline,
    }
  }

  return {
    ...catalog,
    sections: catalog.sections.map((sec) => ({
      ...sec,
      rows: sec.rows.map((row) => ({ ...row, items: row.items.map(enrich) })),
    })),
    hero: enrich(catalog.hero),
  }
}

/**
 * Haalt de EPG op en past 'm toe op de catalogus. Best-effort: bij een te groot
 * bestand of een fout blijft de catalogus ongewijzigd.
 */
export async function loadAndApplyEpg(
  catalog: Catalog,
  at: number,
  signal?: AbortSignal,
): Promise<Catalog> {
  if (!catalog.epgUrl) return catalog
  try {
    const text = await fetchText(catalog.epgUrl, signal)
    if (text.length > MAX_EPG_BYTES) {
      return {
        ...catalog,
        notices: [
          ...(catalog.notices ?? []),
          'EPG overgeslagen: bestand te groot om in de browser te verwerken.',
        ],
      }
    }
    const index = parseXmltv(text)
    return applyEpg(catalog, index, at)
  } catch {
    return catalog
  }
}
