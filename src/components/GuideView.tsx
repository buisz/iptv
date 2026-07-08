import { useRef, useState } from 'react'
import type { MediaItem } from '../types/content'
import type { Source } from '../types/source'
import { isFavorite, toggleFavorite } from '../api/favorites'
import { useLazyChannelEpg } from '../hooks/useLazyChannelEpg'
import { useT } from '../i18n'

/**
 * EPG-tijdlijn per kanaal binnen een map. Elk kanaal is een rij met een strip van
 * het lopende + eerstvolgende programma's. De EPG wordt **lui per kanaal** geladen
 * (alleen zichtbare rijen halen `get_short_epg` op) zodat het ook op een trage/VPN-
 * verbinding snel blijft. Klik op een kanaal = afspelen.
 */

interface GuideViewProps {
  channels: MediaItem[]
  source: Source
  onPlay: (item: MediaItem) => void
  onFavoriteChange?: () => void
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

export default function GuideView({ channels, source, onPlay, onFavoriteChange }: GuideViewProps) {
  return (
    <div className="flex flex-col gap-2">
      {channels.map((item, i) => (
        <GuideRow
          key={`${item.id}-${i}`}
          item={item}
          rowIndex={i}
          source={source}
          onPlay={onPlay}
          onFavoriteChange={onFavoriteChange}
        />
      ))}
    </div>
  )
}

interface GuideRowProps {
  item: MediaItem
  rowIndex: number
  source: Source
  onPlay: (item: MediaItem) => void
  onFavoriteChange?: () => void
}

function GuideRow({ item, rowIndex, source, onPlay, onFavoriteChange }: GuideRowProps) {
  const t = useT()
  const rowRef = useRef<HTMLDivElement>(null)
  const [fav, setFav] = useState(() => isFavorite(item.id))
  const [imgOk, setImgOk] = useState(Boolean(item.backdrop || item.poster))
  const epg = useLazyChannelEpg(rowRef, item, source)

  const now = Date.now()
  const logo = item.backdrop || item.poster

  // Toon alleen lopende + komende programma's, ontdubbel (zelfde starttijd) en bepaal
  // precies één "Nu" (de meest recente die al begonnen is). Voorkomt meerdere "Nu"-blokken.
  const list = (epg ?? [])
    .filter((p) => p.stop > now)
    .filter((p, i, a) => i === 0 || p.start !== a[i - 1].start)
  let nowIdx = -1
  for (let i = 0; i < list.length; i++) if (list[i].start <= now) nowIdx = i

  return (
    <div
      ref={rowRef}
      className="flex items-stretch gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2"
    >
      {/* Kanaal (klik = afspelen) */}
      <button
        data-nav-item
        data-row={rowIndex}
        data-col={0}
        onClick={() => onPlay(item)}
        aria-label={`${item.title} afspelen`}
        className="flex w-40 shrink-0 items-center gap-2.5 rounded-lg p-1.5 text-left outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-buisgroen sm:w-48"
      >
        <span className="grid h-11 w-16 shrink-0 place-items-center overflow-hidden rounded-md bg-antraciet-700">
          {logo && imgOk ? (
            <img src={logo} alt="" loading="lazy" onError={() => setImgOk(false)} className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] font-bold text-mist-400">{item.channelBadge || '•'}</span>
          )}
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 text-sm font-semibold text-mist">{item.title}</span>
          {item.isLiveNow && (
            <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse-soft" /> Live
            </span>
          )}
        </span>
      </button>

      {/* Programmastrip */}
      <div className="row-scroll flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        {epg === null ? (
          <div className="h-12 w-full animate-pulse-soft rounded-lg bg-white/[0.04]" />
        ) : list.length === 0 ? (
          <span className="px-2 text-xs text-mist-400">{t('guide.none')}</span>
        ) : (
          list.map((p, i) => {
            const isNow = i === nowIdx
            const pct = isNow ? Math.min(100, Math.max(0, ((now - p.start) / (p.stop - p.start)) * 100)) : 0
            return (
              <div
                key={i}
                className={[
                  'relative flex h-12 min-w-[8.5rem] max-w-[13rem] shrink-0 flex-col justify-center overflow-hidden rounded-lg px-3 py-1.5',
                  isNow ? 'bg-buisgroen/15 ring-1 ring-buisgroen/40' : 'bg-white/[0.03]',
                ].join(' ')}
              >
                <span className={['text-[11px] font-semibold', isNow ? 'text-buisgroen' : 'text-mist-400'].join(' ')}>
                  {isNow ? t('detail.now') : clock(p.start)}
                </span>
                <span className="line-clamp-1 text-xs font-medium text-mist">{p.title}</span>
                {isNow && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
                    <span className="block h-full bg-buisgroen" style={{ width: `${pct}%` }} />
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Favoriet */}
      <button
        onClick={() => {
          setFav(toggleFavorite(item))
          onFavoriteChange?.()
        }}
        aria-label={fav ? 'Uit favorieten' : 'Aan favorieten toevoegen'}
        aria-pressed={fav}
        className={[
          'grid h-9 w-9 shrink-0 place-items-center self-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-buisgroen',
          fav ? 'bg-buisgroen text-antraciet-900' : 'text-mist-400 hover:text-buisgroen',
        ].join(' ')}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
