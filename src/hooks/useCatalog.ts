import { useCallback, useEffect, useRef, useState } from 'react'
import type { Catalog } from '../types/content'
import type { Source } from '../types/source'
import { DEMO_SOURCE } from '../types/source'
import { demoCatalog, loadCatalog } from '../api/catalog'
import { loadAndApplyEpg } from '../api/epg'
import { markCatalogLoaded, resetHealth } from '../api/health'

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
  /** Wissel van bron; laadt en bewaart bij succes. Geeft true terug bij succes. */
  setSource: (source: Source) => Promise<boolean>
  /** Terug naar de demo-bron. */
  reset: () => void
  /** Vervang het actieve catalogus-item (bijv. na TMDB-verrijking). */
  patchCatalog: (updater: (prev: Catalog) => Catalog) => void
  /** Was er bij opstart al een echte (niet-demo) bron bewaard? */
  configured: boolean
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
  const [configured] = useState(() => readStoredSource().kind !== 'demo')
  const abortRef = useRef<AbortController | null>(null)

  /** Laadt een bron; geeft true terug bij succes, false bij fout/abort. */
  const load = useCallback(async (next: Source): Promise<boolean> => {
    abortRef.current?.abort()
    // AbortController ontbreekt op de oudste TV-engines (< Chromium 66) —
    // dan draaien we zonder annulering i.p.v. te crashen.
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null
    abortRef.current = controller
    const aborted = () => controller?.signal.aborted ?? false

    setLoading(true)
    setError(null)
    resetHealth() // nieuwe bron → schone verbindingsdiagnose
    try {
      const result = await loadCatalog(next, controller?.signal)
      if (aborted()) return false
      // Catalogus geladen = account/API bereikbaar; basis voor de geo-/netwerkdiagnose.
      if (next.kind !== 'demo') markCatalogLoaded()
      setCatalog(result)
      setSourceState(next)
      storeSource(next)

      // EPG op de achtergrond toepassen (live nu/straks) — niet-blokkerend.
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

  return { source, catalog, loading, error, setSource: load, reset, patchCatalog, configured }
}
