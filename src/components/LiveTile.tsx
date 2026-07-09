import { useRef } from 'react'
import type { MediaItem } from '../types/content'
import type { Source } from '../types/source'
import PosterCard from './PosterCard'
import { pickNowNext, useLazyChannelEpg } from '../hooks/useLazyChannelEpg'

/**
 * Zender-tegel die lui de EPG laadt en NU/STRAKS in de PosterCard toont. Gedeeld
 * door de Live-browser (grid) én de "TV"-rij op Home, zodat overal dezelfde
 * nu/straks-info verschijnt zonder alle kanalen tegelijk te bevragen.
 */
export default function LiveTile({
  item,
  source,
  row,
  col,
  fill,
  onOpen,
  onFavoriteChange,
}: {
  item: MediaItem
  source: Source
  row: number
  col: number
  fill?: boolean
  onOpen: (item: MediaItem) => void
  onFavoriteChange?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const epg = useLazyChannelEpg(ref, item, source)
  const { now, next } = pickNowNext(epg, Date.now())
  const withEpg = now || next ? { ...item, epgNow: now, epgNext: next } : item
  return (
    <div ref={ref} className={fill ? undefined : 'shrink-0'}>
      <PosterCard item={withEpg} row={row} col={col} fill={fill} onOpen={onOpen} onFavoriteChange={onFavoriteChange} />
    </div>
  )
}
