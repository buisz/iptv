import { useCallback, useEffect, useRef, useState } from 'react'
import type { Catalog } from '../types/content'
import type { Source } from '../types/source'
import { DEMO_SOURCE } from '../types/source'
import { demoCatalog, loadCatalog } from '../api/catalog'
import { loadAndApplyEpg } from '../api/epg'
import { markCatalogLoaded, resetHealth } from '../api/health'
import { mergeCatalogs } from '../api/merge'
import {
  addSavedSource,
  getActiveSaved,
  getMergeEnabled,
  getSavedSources,
  removeSavedSource,
  setActiveSourceId,
  setMergeEnabled,
  updateSavedSource,
  type SavedSource,
} from '../api/sources'

export interface UseCatalog {
  source: Source
  catalog: Catalog
  loading: boolean
  error: string | null
  /** Opgeslagen bronnen + status voor het bronbeheer. */
  savedSources: SavedSource[]
  activeId: string | null
  merged: boolean
  /** Voeg een bron toe, maak 'm actief en laad. (Ook door wizard/onboarding.) */
  setSource: (source: Source) => Promise<boolean>
  /** Werk een bestaande bron bij en herlaad. */
  updateSource: (id: string, source: Source) => Promise<boolean>
  /** Wissel de actieve bron (bij niet-samengevoegd). */
  switchSource: (id: string) => Promise<boolean>
  /** Verwijder een bron en herlaad de selectie. */
  removeSource: (id: string) => Promise<boolean>
  /** Zet samenvoegen aan/uit en herlaad. */
  setMerge: (on: boolean) => Promise<boolean>
  /** Terug naar de demo-bron. */
  reset: () => void
  patchCatalog: (updater: (prev: Catalog) => Catalog) => void
  configured: boolean
}

/**
 * Beheert de bron(nen) en de bijbehorende catalogus. Start met de demo (synchroon),
 * en laadt daarna de opgeslagen bron(nen) — één actief, of alles samengevoegd.
 */
export function useCatalog(): UseCatalog {
  const [source, setSourceState] = useState<Source>(DEMO_SOURCE)
  const [catalog, setCatalog] = useState<Catalog>(() => demoCatalog())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedSources, setSavedSources] = useState<SavedSource[]>(() => getSavedSources())
  const [activeId, setActiveId] = useState<string | null>(() => getActiveSaved()?.id ?? null)
  const [merged, setMerged] = useState(false)
  const [configured] = useState(() => getSavedSources().some((s) => s.source.kind !== 'demo'))
  const abortRef = useRef<AbortController | null>(null)

  /** Laadt de huidige selectie (actieve bron óf samengevoegd). */
  const loadSelection = useCallback(async (): Promise<boolean> => {
    abortRef.current?.abort()
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    abortRef.current = controller
    const aborted = () => controller?.signal.aborted ?? false

    const reals = getSavedSources().filter((s) => s.source.kind !== 'demo')
    setSavedSources(getSavedSources())
    setActiveId(getActiveSaved()?.id ?? null)

    // Geen echte bron → demo.
    if (!reals.length) {
      setMerged(false)
      setSourceState(DEMO_SOURCE)
      setCatalog(demoCatalog())
      setLoading(false)
      return true
    }

    setLoading(true)
    setError(null)
    resetHealth()

    const mergeOn = getMergeEnabled() && reals.length > 1
    setMerged(mergeOn)

    try {
      if (mergeOn) {
        // Samengevoegd: alle bronnen laden (met per-bron XMLTV-EPG), dan mergen.
        const parts = await Promise.all(
          reals.map(async (saved) => {
            let cat = await loadCatalog(saved.source, controller?.signal)
            if (cat.epgUrl) {
              try {
                cat = await loadAndApplyEpg(cat, Date.now(), controller?.signal)
              } catch {
                /* EPG optioneel */
              }
            }
            return { saved, catalog: cat }
          }),
        )
        if (aborted()) return false
        markCatalogLoaded()
        setCatalog(mergeCatalogs(parts))
        setSourceState(reals[0].source) // representatief; items dragen hun eigen bron
        return true
      }

      // Eén actieve bron — progressief laden.
      const active = getActiveSaved() ?? reals[0]
      const onPartial = (partial: Catalog) => {
        if (aborted()) return
        setCatalog(partial)
        setSourceState(active.source)
      }
      const result = await loadCatalog(active.source, controller?.signal, onPartial)
      if (aborted()) return false
      markCatalogLoaded()
      setCatalog(result)
      setSourceState(active.source)
      if (result.epgUrl) {
        void loadAndApplyEpg(result, Date.now(), controller?.signal).then((withEpg) => {
          if (!aborted() && withEpg !== result) setCatalog(withEpg)
        })
      }
      return true
    } catch (err) {
      if (aborted()) return false
      setError((err as Error).message || 'Laden van de bron mislukt.')
      return false
    } finally {
      if (!aborted()) setLoading(false)
    }
  }, [])

  // Eenmalig: laad de opgeslagen selectie na de eerste render.
  useEffect(() => {
    if (getSavedSources().some((s) => s.source.kind !== 'demo')) void loadSelection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setSource = useCallback(
    async (next: Source): Promise<boolean> => {
      addSavedSource(next) // maakt 'm ook actief
      return loadSelection()
    },
    [loadSelection],
  )

  const updateSource = useCallback(
    async (id: string, next: Source): Promise<boolean> => {
      updateSavedSource(id, next)
      return loadSelection()
    },
    [loadSelection],
  )

  const switchSource = useCallback(
    async (id: string): Promise<boolean> => {
      setActiveSourceId(id)
      return loadSelection()
    },
    [loadSelection],
  )

  const removeSource = useCallback(
    async (id: string): Promise<boolean> => {
      removeSavedSource(id)
      return loadSelection()
    },
    [loadSelection],
  )

  const setMerge = useCallback(
    async (on: boolean): Promise<boolean> => {
      setMergeEnabled(on)
      return loadSelection()
    },
    [loadSelection],
  )

  const reset = useCallback(() => {
    abortRef.current?.abort()
    // Alle opgeslagen bronnen weghalen → terug naar demo.
    for (const s of getSavedSources()) removeSavedSource(s.id)
    setMergeEnabled(false)
    setError(null)
    setLoading(false)
    setMerged(false)
    setSavedSources([])
    setActiveId(null)
    setSourceState(DEMO_SOURCE)
    setCatalog(demoCatalog())
  }, [])

  const patchCatalog = useCallback((updater: (prev: Catalog) => Catalog) => {
    setCatalog((prev) => updater(prev))
  }, [])

  return {
    source,
    catalog,
    loading,
    error,
    savedSources,
    activeId,
    merged,
    setSource,
    updateSource,
    switchSource,
    removeSource,
    setMerge,
    reset,
    patchCatalog,
    configured,
  }
}
