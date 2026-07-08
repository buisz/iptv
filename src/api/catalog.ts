/**
 * Bron-agnostische cataloguslader (fase 2).
 *
 * Eén ingang voor de UI: geef een Source, krijg een Catalog. De demo-bron geeft
 * de mockdata synchroon terug; de echte bronnen halen en parseren hun data.
 */
import type { Catalog } from '../types/content'
import type { Source } from '../types/source'
import { heroItem, sections } from '../data/mockContent'
import { loadM3uTextCatalog, loadM3uUrlCatalog } from './m3u'
import { loadXtreamCatalog } from './xtream'

/** Demo-catalogus uit de mockdata van fase 1. */
export function demoCatalog(): Catalog {
  return {
    sections,
    hero: heroItem,
    sourceLabel: 'Demo-bron',
  }
}

/**
 * @param onPartial  Optionele callback die (voor Xtream) tussentijdse, groeiende
 *   catalogi doorgeeft naarmate live/films/series binnenkomen — zodat de UI al
 *   toont wat er is i.p.v. te wachten op de volledige download.
 */
export async function loadCatalog(
  source: Source,
  signal?: AbortSignal,
  onPartial?: (partial: Catalog) => void,
): Promise<Catalog> {
  switch (source.kind) {
    case 'demo':
      return demoCatalog()
    case 'm3u-url':
      return loadM3uUrlCatalog(source, signal)
    case 'm3u-text':
      return loadM3uTextCatalog(source)
    case 'xtream':
      return loadXtreamCatalog(source, signal, onPartial)
  }
}
