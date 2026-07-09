import { useRef, useState } from 'react'
import type { MediaItem } from '../types/content'
import type { Source } from '../types/source'
import { isFavorite, toggleFavorite } from '../api/favorites'
import { useLazyChannelEpg } from '../hooks/useLazyChannelEpg'
import { useImgFallback } from '../hooks/useImgFallback'
import { useVirtualRows } from '../hooks/useVirtualRows'
import HScrollbar from './HScrollbar'
import { clock, fmtTime } from '../lib/time'

/**
 * Echte EPG-gids: één bevroren tijd-balk bovenaan + een gedeelde tijd-as, kanalen
 * eronder uitgelijnd op tijd, met een "nu"-lijn. Alles scrollt in één container:
 * verticaal door de kanalen, horizontaal door de tijd (kanaalkolom en tijd-balk
 * blijven sticky). Zo geen wiel-kaping en één duidelijke scrollbalk.
 */

const CHANNEL_COL = 176 // px, breedte kanaalkolom
const ROW_H = 60 // px, hoogte kanaalrij
const HEADER_H = 34 // px, hoogte tijd-balk
const PX_PER_MIN = 6 // 30 min = 180px
const WINDOW_HOURS = 6
const SLOT_MIN = 30
const SLOT_PX = SLOT_MIN * PX_PER_MIN

interface GuideGridProps {
  channels: MediaItem[]
  source: Source
  onPlay: (item: MediaItem) => void
  onFavoriteChange?: () => void
}

// Verticale rasterlijnen elke 30 min, voor uitlijning met de tijd-balk.
const GRID_BG: React.CSSProperties = {
  backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px)',
  backgroundSize: `${SLOT_PX}px 100%`,
}

export default function GuideGrid({ channels, source, onPlay, onFavoriteChange }: GuideGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Verticale virtualisatie: alleen zichtbare rijen renderen (grote maps = duizenden
  // kanalen → anders duizenden rijen + IntersectionObservers tegelijk).
  const { start, end, totalHeight, offsetTop } = useVirtualRows(scrollRef, {
    count: channels.length,
    rowHeight: ROW_H,
    columns: 1,
    overscan: 6,
  })
  const now = Date.now()
  const slotMs = SLOT_MIN * 60_000
  const windowStart = Math.floor(now / slotMs) * slotMs
  const windowEnd = windowStart + WINDOW_HOURS * 60 * 60_000
  const timelineW = WINDOW_HOURS * 60 * PX_PER_MIN
  const nowX = ((now - windowStart) / 60_000) * PX_PER_MIN

  const marks: number[] = []
  for (let t = windowStart; t <= windowEnd; t += slotMs) marks.push(t)

  return (
    <>
    <div ref={scrollRef} className="grid-scroll relative rounded-xl border border-white/[0.06]" style={{ maxHeight: '72vh' }}>
      <div className="relative" style={{ width: CHANNEL_COL + timelineW }}>
        {/* Tijd-balk (sticky top) */}
        <div className="sticky top-0 z-20 flex bg-antraciet-800" style={{ height: HEADER_H }}>
          <div
            className="sticky left-0 z-30 shrink-0 border-r border-white/[0.08] bg-antraciet-800"
            style={{ width: CHANNEL_COL }}
          />
          <div className="relative" style={{ width: timelineW }}>
            {marks.map((t) => (
              <div
                key={t}
                className="absolute top-0 flex h-full items-center border-l border-white/10 pl-2 text-xs font-semibold text-mist-400"
                style={{ left: ((t - windowStart) / 60_000) * PX_PER_MIN }}
              >
                {clock(t)}
              </div>
            ))}
          </div>
        </div>

        {/* "Nu"-lijn over alle rijen (achter de sticky kanaalkolom). */}
        <div
          className="pointer-events-none absolute z-10 w-0.5 bg-red-500"
          style={{ left: CHANNEL_COL + nowX, top: HEADER_H, bottom: 0 }}
        />

        {/* Kanaalrijen (gevirtualiseerd): spacer op ware hoogte, alleen zichtbare rijen. */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ position: 'absolute', top: offsetTop, left: 0, right: 0 }}>
            {channels.slice(start, end).map((item) => (
              <GuideGridRow
                key={item.id}
                item={item}
                source={source}
                windowStart={windowStart}
                windowEnd={windowEnd}
                timelineW={timelineW}
                onPlay={onPlay}
                onFavoriteChange={onFavoriteChange}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
    {/* Altijd-zichtbaar, sleep-/klikbaar schuifje voor de tijd-as. */}
    <HScrollbar targetRef={scrollRef} />
    </>
  )
}

interface RowProps {
  item: MediaItem
  source: Source
  windowStart: number
  windowEnd: number
  timelineW: number
  onPlay: (item: MediaItem) => void
  onFavoriteChange?: () => void
}

function GuideGridRow({ item, source, windowStart, windowEnd, timelineW, onPlay, onFavoriteChange }: RowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const epg = useLazyChannelEpg(ref, item, source)
  const [fav, setFav] = useState(() => isFavorite(item.id))
  const { src: logo, failed: logoFailed, onError: onLogoError } = useImgFallback(item.backdrop || item.poster, true)
  const now = Date.now()

  const blocks = (epg ?? [])
    .filter((p) => p.stop > windowStart && p.start < windowEnd)
    .filter((p, i, a) => i === 0 || p.start !== a[i - 1].start)

  // Niks in dit tijdvenster maar wél EPG? Toon het eerstvolgende met datum
  // (bijv. een F1-sessie op vrijdag) i.p.v. een lege rij die "nu" lijkt.
  const nextOutside =
    blocks.length === 0 && epg && epg.length ? epg.find((p) => p.stop > now) ?? epg[epg.length - 1] : undefined

  return (
    <div ref={ref} className="flex border-t border-white/[0.06]" style={{ height: ROW_H }}>
      {/* Kanaal (sticky links) */}
      <div
        className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-white/[0.08] bg-antraciet-800 pl-2 pr-1"
        style={{ width: CHANNEL_COL }}
      >
        <button
          onClick={() => onPlay(item)}
          aria-label={`${item.title} afspelen`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-buisgroen"
        >
          <span className="grid h-9 w-12 shrink-0 place-items-center overflow-hidden rounded bg-antraciet-700">
            {logo && !logoFailed ? (
              <img src={logo} alt="" loading="lazy" onError={onLogoError} className="h-full w-full object-contain" />
            ) : (
              <span className="text-[9px] font-bold text-mist-400">{item.channelBadge || '•'}</span>
            )}
          </span>
          <span className="line-clamp-2 min-w-0 text-xs font-semibold text-mist">{item.title}</span>
        </button>
        <button
          onClick={() => {
            setFav(toggleFavorite(item))
            onFavoriteChange?.()
          }}
          aria-label={fav ? 'Uit favorieten' : 'Aan favorieten toevoegen'}
          aria-pressed={fav}
          className={[
            'grid h-7 w-7 shrink-0 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-buisgroen',
            fav ? 'text-buisgroen' : 'text-mist-500 hover:text-buisgroen',
          ].join(' ')}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Programma's op de tijd-as */}
      <div className="relative" style={{ width: timelineW, ...GRID_BG }}>
        {epg === null ? (
          <div className="absolute inset-1 animate-pulse-soft rounded bg-white/[0.04]" />
        ) : nextOutside ? (
          // Buiten het tijdvenster: sticky links zodat je 't ziet zonder te scrollen.
          <div className="sticky left-0 flex h-full max-w-[60vw] items-center gap-2 px-3 text-xs text-mist-400">
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-semibold">
              {fmtTime(nextOutside.start, now)}
            </span>
            <span className="truncate">{nextOutside.title}</span>
          </div>
        ) : (
          blocks.map((p, i) => {
            const left = Math.max(0, ((p.start - windowStart) / 60_000) * PX_PER_MIN)
            const rightRaw = ((p.stop - windowStart) / 60_000) * PX_PER_MIN
            // Nooit over het volgende blok heen tekenen — vangt residuele overlap in de
            // brondata op zodat blokken niet stapelen.
            const nextLeft =
              i + 1 < blocks.length ? ((blocks[i + 1].start - windowStart) / 60_000) * PX_PER_MIN : Infinity
            const width = Math.max(3, Math.min(timelineW, rightRaw, nextLeft) - left)
            const isNow = p.start <= now && now < p.stop
            return (
              <button
                key={i}
                onClick={() => onPlay(item)}
                title={`${p.title} · ${fmtTime(p.start, now)}–${clock(p.stop)}`}
                className={[
                  'absolute top-1 bottom-1 flex flex-col justify-center overflow-hidden rounded px-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-buisgroen',
                  isNow ? 'bg-buisgroen/20 ring-1 ring-buisgroen/40 hover:bg-buisgroen/25' : 'bg-white/[0.05] hover:bg-white/[0.09]',
                ].join(' ')}
                style={{ left, width }}
              >
                <span className={['line-clamp-1 text-xs font-semibold', isNow ? 'text-mist' : 'text-mist'].join(' ')}>
                  {p.title}
                </span>
                <span className="line-clamp-1 text-[10px] text-mist-400">{clock(p.start)}</span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
