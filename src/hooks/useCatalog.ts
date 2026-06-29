import { useCallback, useEffect, useRef, useState } from 'react'
import type { Catalog } from '../types/content'
import type { Source } from '../types/source'
import { DEMO_SOURCE } from '../types/source'
import { demoCatalog, loadCatalog } from '../api/catalog'
import { loadAndApplyEpg } from '../api/epg'

const STORAGE_KEY = 'buisz.source'

function readStoredSource(): Source {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEMO_SOURCE
    const parsed = JSON.parse(raw) as Source
    return parsed?.kind ? parsed : DEMO_SOURCE
  } catch {
    return DEMO_SOURCE
  }
}

function storeSource(source: Source): void {
  try {
    if (source.kind === 'demo') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(source))
  } catch {
    /* localStorage niet beschikbaar — bron blijft alleen in geheugen */
  }
}

export interface UseCatalog {
  source: Source
  catalog: Catalog
  loading: boolean
  error: string | null
  /** Wissel van bron; laadt en bewaart bij succes. */
  setSource: (source: Source) => Promise<void>
  /** Terug naar de demo-bron. */
  reset: () => void
  /** Vervang het actieve catalogus-item (bijv. na TMDB-verrijking). */
  patchCatalog: (updater: (prev: Catalog) => Catalog) => void
}

/**
 * Beheert de actieve bron en de bijbehorende catalogus. Start altijd direct met
 * de demo (synchroon, geen laadflits); een bewaarde echte bron wordt daarna op
 * de achtergrond geladen.
 */
export function useCatalog(): UseCatalog {
  const [source, setSourceState] = useState<Source>(DEMO_SOURCE)
  const [catalog, setCatalog] = useState<Catalog>(() => demoCatalog())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (next: Source) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const result = await loadCatalog(next, controller.signal)
      if (controller.signal.aborted) return
      setCatalog(result)
      setSourceState(next)
      storeSource(next)

      // EPG op de achtergrond toepassen (live nu/straks) — niet-blokkerend.
      if (result.epgUrl) {
        void loadAndApplyEpg(result, Date.now(), controller.signal).then((withEpg) => {
          if (!controller.signal.aborted && withEpg !== result) setCatalog(withEpg)
        })
      }
    } catch (err) {
      if (controller.signal.aborted) return
      setError((err as Error).message || 'Laden van de bron mislukt.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  // Eenmalig: laad een eventueel bewaarde echte bron na de eerste render.
  useEffect(() => {
    const stored = readStoredSource()
    if (stored.kind !== 'demo') void load(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setError(null)
    setLoading(false)
    setSourceState(DEMO_SOURCE)
    setCatalog(demoCatalog())
    storeSource(DEMO_SOURCE)
  }, [])

  const patchCatalog = useCallback((updater: (prev: Catalog) => Catalog) => {
    setCatalog((prev) => updater(prev))
  }, [])

  return { source, catalog, loading, error, setSource: load, reset, patchCatalog }
}
