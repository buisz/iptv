import { useEffect, useRef, useState, type RefObject } from 'react'
import type { EpgEntry, MediaItem } from '../types/content'
import type { Source } from '../types/source'
import { loadShortEpg } from '../api/xtream'
import { resolveSource } from '../api/sources'

const MAX_EPG_ATTEMPTS = 3

/**
 * Laadt de EPG van één kanaal **lui** (pas als het element in beeld komt), via
 * Xtream `get_short_epg` (betrouwbaar per stream_id) met terugval op de vooraf
 * toegepaste XMLTV-nu/straks. Zo blijft een grote map licht: alleen zichtbare
 * kanalen doen een call. Gedeeld door de gids-rijen én de grid-tegels.
 */
export function useLazyChannelEpg(
  ref: RefObject<HTMLElement | null>,
  item: MediaItem,
  source: Source,
): EpgEntry[] | null {
  const [visible, setVisible] = useState(false)
  const [epg, setEpg] = useState<EpgEntry[] | null>(null)
  const attempts = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '250px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref])

  useEffect(() => {
    if (!visible || epg) return

    // XMLTV eerst (gratis, al gedownload): heeft dit kanaal al nu/straks, dan géén
    // per-kanaal-call doen — dat scheelt bij providers waar de XMLTV goed matcht.
    const fromXmltv = [item.epgNow, item.epgNext].filter(Boolean) as EpgEntry[]
    if (fromXmltv.length) {
      setEpg(fromXmltv)
      return
    }

    // In de samengevoegde weergave komt het item van een andere bron dan de actieve:
    // gebruik de bron van het item zelf voor de per-kanaal-EPG.
    const itemSource = (item.sourceId ? resolveSource(item.sourceId) : undefined) ?? source

    // Alleen Xtream-live kan per kanaal EPG leveren; anders definitief leeg.
    if (!(itemSource.kind === 'xtream' && item.ref?.kind === 'xtream-live')) {
      setEpg([])
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const streamId = item.ref.id

    const tryFetch = async () => {
      try {
        const list = await loadShortEpg(itemSource, streamId, 8)
        // Succes (ook een lege lijst = provider heeft géén EPG) → definitief.
        if (!cancelled) setEpg(list)
      } catch {
        // Throttled/fout: begrensd + gespreid opnieuw, zodat de tegel alsnog vult
        // zodra de limiter hersteld is — zonder opnieuw te stormen.
        if (cancelled) return
        attempts.current += 1
        if (attempts.current < MAX_EPG_ATTEMPTS) {
          const delay = 3000 * attempts.current + Math.random() * 2500 // jitter
          timer = setTimeout(tryFetch, delay)
        } else {
          setEpg([]) // opgegeven → geen verdere pogingen deze mount
        }
      }
    }
    void tryFetch()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [visible, epg, source, item])

  return epg
}

/** Kies het lopende + eerstvolgende programma uit een (gesorteerde) lijst. */
export function pickNowNext(list: EpgEntry[] | null, at: number): { now?: EpgEntry; next?: EpgEntry } {
  if (!list || !list.length) return {}
  let now: EpgEntry | undefined
  let next: EpgEntry | undefined
  for (const p of list) {
    if (p.start <= at && at < p.stop) now = p
    else if (p.start > at && !next) next = p
  }
  return { now, next }
}
