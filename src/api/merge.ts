/**
 * Samenvoegen van meerdere bron-catalogi tot één bibliotheek.
 *
 * - Elk item krijgt een herkomst-tag (`sourceId`/`sourceName`) voor de subtiele
 *   bronaanduiding en per-bron afspelen.
 * - Rijen met dezelfde categorienaam worden samengevoegd.
 * - Live-kanalen die in meerdere bronnen voorkomen worden ontdubbeld tot één tegel
 *   met `altSources`, zodat je kunt kiezen via welke bron je afspeelt (à la
 *   TiviMate's "hide duplicates", maar met behoud van de keuze).
 */
import type { AltSource, Catalog, CatalogSection, ContentRowData, MediaItem } from '../types/content'
import type { SavedSource } from './sources'
import { normName } from './epg'
import { pickRandom } from '../lib/rand'

/** Kloon een catalogus-item en zet de herkomst erop (indien nog niet gezet). */
function tag(item: MediaItem, saved: SavedSource): MediaItem {
  return { ...item, sourceId: item.sourceId ?? saved.id, sourceName: item.sourceName ?? saved.name }
}

function keyOf(item: MediaItem): string {
  return item.kind + '::' + normName(item.title)
}

/** Ontdubbel binnen één (samengevoegde) rij: eerste wint, rest wordt alternatief. */
function dedupe(items: MediaItem[]): MediaItem[] {
  const byKey = new Map<string, MediaItem>()
  const out: MediaItem[] = []
  for (const it of items) {
    const k = keyOf(it)
    const prev = byKey.get(k)
    if (!prev) {
      const copy = { ...it }
      byKey.set(k, copy)
      out.push(copy)
      continue
    }
    // Duplicaat uit een andere bron → als alternatief onthouden (niet nogmaals tonen).
    if (prev.sourceId === it.sourceId) continue
    const alt: AltSource = {
      sourceId: it.sourceId!,
      sourceName: it.sourceName || '',
      streamUrl: it.streamUrl,
      ref: it.ref,
    }
    prev.altSources = [...(prev.altSources ?? []), alt]
  }
  return out
}

/** Voeg de rijen van alle bronnen voor één sectie-key samen, op categorienaam. */
function mergeRows(rowsPerSource: ContentRowData[][]): ContentRowData[] {
  const order: string[] = []
  const byTitle = new Map<string, MediaItem[]>()
  for (const rows of rowsPerSource) {
    for (const row of rows) {
      const t = row.title
      if (!byTitle.has(t)) {
        byTitle.set(t, [])
        order.push(t)
      }
      byTitle.get(t)!.push(...row.items)
    }
  }
  return order.map((t, i) => ({
    id: `merged-${i}-${t}`,
    title: t,
    items: dedupe(byTitle.get(t)!),
  }))
}

export function mergeCatalogs(parts: { saved: SavedSource; catalog: Catalog }[]): Catalog {
  // 1) Alle items taggen met hun herkomst.
  const tagged = parts.map(({ saved, catalog }) => ({
    saved,
    sections: catalog.sections.map((sec) => ({
      ...sec,
      rows: sec.rows.map((row) => ({ ...row, items: row.items.map((it) => tag(it, saved)) })),
    })),
    allItems: (catalog.allItems ?? []).map((it) => tag(it, saved)),
  }))

  // 2) Per sectie-key (behalve home) de rijen samenvoegen.
  const keys = ['live', 'films', 'series']
  const labels: Record<string, string> = { live: 'TV', films: 'Films', series: 'Series' }
  const sections: CatalogSection[] = []
  for (const key of keys) {
    const rowsPerSource = tagged
      .map((p) => p.sections.find((s) => s.key === key)?.rows ?? [])
      .filter((r) => r.length)
    if (!rowsPerSource.length) continue
    sections.push({ key, label: labels[key], rows: mergeRows(rowsPerSource) })
  }
  if (!sections.length) {
    // Niets bruikbaars — geef de eerste catalogus ongewijzigd terug.
    return parts[0].catalog
  }

  // 3) Home opnieuw opbouwen uit de eerste rijen van de samengevoegde secties.
  const sec = (k: string) => sections.find((s) => s.key === k)
  const homeRows: ContentRowData[] = []
  const films = sec('films')?.rows
  const series = sec('series')?.rows
  const live = sec('live')?.rows
  if (films?.[0]) homeRows.push({ ...films[0], id: 'home-films', title: 'Films — uitgelicht' })
  if (series?.[0]) homeRows.push({ ...series[0], id: 'home-series', title: 'Series — uitgelicht' })
  if (live?.[0]) homeRows.push({ ...live[0], id: 'home-live', title: 'TV' })
  if (films?.[1]) homeRows.push({ ...films[1], id: 'home-films-2' })
  if (homeRows.length) sections.unshift({ key: 'home', label: 'Home', rows: homeRows })

  // 4) Volledige itemlijst (voor zoeken) + willekeurige hero met achtergrond.
  const allItems: MediaItem[] = []
  const seen = new Set<string>()
  for (const p of tagged) {
    for (const it of p.allItems) {
      if (!seen.has(it.id)) {
        seen.add(it.id)
        allItems.push(it)
      }
    }
  }
  const heroPool = allItems.filter((i) => i.backdrop && i.synopsis)
  const hero =
    pickRandom(heroPool) ??
    pickRandom(allItems.filter((i) => i.backdrop)) ??
    pickRandom(allItems.filter((i) => i.poster)) ??
    sections[0].rows[0].items[0]

  const notices = parts.flatMap((p) => p.catalog.notices ?? [])

  return {
    sections,
    hero,
    sourceLabel: `${parts.length} bronnen samengevoegd`,
    allItems,
    notices: notices.length ? notices : undefined,
  }
}
