import { useEffect, useState, type RefObject } from 'react'
import type { EpgEntry, MediaItem } from '../types/content'
import type { Source } from '../types/source'
import { loadShortEpg } from '../api/xtream'

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
    let cancelled = false
    void (async () => {
      let list: EpgEntry[] = []
      if (source.kind === 'xtream' && item.ref?.kind === 'xtream-live') {
        try {
          list = await loadShortEpg(source, item.ref.id, 8)
        } catch {
          /* val terug op XMLTV-nu/straks */
        }
      }
      if (!list.length) {
        list = [item.epgNow, item.epgNext].filter(Boolean) as EpgEntry[]
      }
      if (!cancelled) setEpg(list)
    })()
    return () => {
      cancelled = true
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
