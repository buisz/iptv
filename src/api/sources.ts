/**
 * Beheer van meerdere bronnen (m3u/Xtream) + de samenvoeg-optie.
 *
 * Model (community-norm, à la TiviMate/IPTV Smarters): een lijst opgeslagen bronnen,
 * één actief, of alles **samengevoegd** tot één bibliotheek. Bij samenvoegen krijgt
 * elk item een herkomst-tag zodat je subtiel ziet — en kunt kiezen — van welke bron
 * je afspeelt.
 *
 * Alles lokaal (localStorage). Xtream-gegevens blijven op het toestel; ze reizen pas
 * mee met Cloud Sync als die er E2E-versleuteld is (zie backlog PBI-001).
 */
import type { Source } from '../types/source'
import { describeSource } from '../types/source'

export interface SavedSource {
  id: string
  name: string
  source: Source
}

const SOURCES_KEY = 'buisz.sources'
const ACTIVE_KEY = 'buisz.activeSource'
const MERGE_KEY = 'buisz.mergeSources'
const LEGACY_KEY = 'buisz.source' // losse bron van vóór multi-bron

let cache: SavedSource[] | null = null

function genId(): string {
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function persist(list: SavedSource[]): void {
  cache = list
  try {
    localStorage.setItem(SOURCES_KEY, JSON.stringify(list))
  } catch {
    /* geen opslag — blijft in geheugen */
  }
}

function read(): SavedSource[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(SOURCES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        cache = parsed as SavedSource[]
        return cache
      }
    }
  } catch {
    /* val door naar migratie/leeg */
  }
  // Migratie: zet een bestaande losse bron om naar één opgeslagen bron.
  try {
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const src = JSON.parse(legacy) as Source
      if (src?.kind && src.kind !== 'demo') {
        const migrated: SavedSource = { id: genId(), name: describeSource(src), source: src }
        persist([migrated])
        try {
          localStorage.setItem(ACTIVE_KEY, migrated.id)
        } catch {
          /* negeren */
        }
        return cache!
      }
    }
  } catch {
    /* negeren */
  }
  cache = []
  return cache
}

export function getSavedSources(): SavedSource[] {
  return read()
}

export function getActiveSourceId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function setActiveSourceId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id)
  } catch {
    /* negeren */
  }
}

/** De actieve opgeslagen bron (of de eerste als er geen expliciete keuze is). */
export function getActiveSaved(): SavedSource | undefined {
  const list = read()
  const id = getActiveSourceId()
  return list.find((s) => s.id === id) ?? list[0]
}

export function getMergeEnabled(): boolean {
  try {
    return localStorage.getItem(MERGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setMergeEnabled(v: boolean): void {
  try {
    localStorage.setItem(MERGE_KEY, v ? '1' : '0')
  } catch {
    /* negeren */
  }
}

/** Voeg een bron toe en maak 'm actief. Geeft de opgeslagen bron terug. */
export function addSavedSource(source: Source, name?: string): SavedSource {
  const saved: SavedSource = { id: genId(), name: name?.trim() || describeSource(source), source }
  persist([...read(), saved])
  setActiveSourceId(saved.id)
  return saved
}

/** Werk de config (en optioneel de naam) van een bestaande bron bij. */
export function updateSavedSource(id: string, source: Source, name?: string): void {
  persist(read().map((s) => (s.id === id ? { ...s, source, name: name?.trim() || s.name } : s)))
}

export function removeSavedSource(id: string): void {
  persist(read().filter((s) => s.id !== id))
  if (getActiveSourceId() === id) {
    const first = read()[0]
    if (first) setActiveSourceId(first.id)
  }
}

export function renameSavedSource(id: string, name: string): void {
  persist(read().map((s) => (s.id === id ? { ...s, name: name.trim() || s.name } : s)))
}

/** Bron-config bij een id (voor per-item EPG/afspelen in de samengevoegde weergave). */
export function resolveSource(id?: string): Source | undefined {
  if (!id) return undefined
  return read().find((s) => s.id === id)?.source
}
