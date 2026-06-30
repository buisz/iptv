import { useState } from 'react'
import type { MediaItem } from '../types/content'
import PlayabilityBadge from './PlayabilityBadge'

interface PosterCardProps {
  item: MediaItem
  row: number
  col: number
  showProgress?: boolean
  onOpen: (item: MediaItem) => void
}

export default function PosterCard({ item, row, col, showProgress, onOpen }: PosterCardProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const isLive = item.kind === 'live'
  const src = isLive ? item.backdrop : item.poster
  const hasImage = Boolean(src) && !failed

  return (
    <button
      data-nav-item
      data-row={row}
      data-col={col}
      onClick={() => onOpen(item)}
      aria-label={`${item.title}${item.tagline ? ` — ${item.tagline}` : ''}`}
      className={[
        'group relative shrink-0 snap-start overflow-hidden rounded-[var(--radius-card)] outline-none',
        'bg-antraciet-700 transition-transform duration-300 ease-out will-change-transform',
        // Signature focus/hover-highlight in Buisgroen — kern voor remote-navigatie.
        'ring-1 ring-white/[0.06]',
        'hover:scale-[1.05] hover:z-10 hover:ring-buisgroen/70 hover:shadow-focus',
        'focus-visible:scale-[1.05] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-buisgroen focus-visible:shadow-focus',
        isLive ? 'aspect-video w-[260px] sm:w-[300px]' : 'aspect-[2/3] w-[150px] sm:w-[176px]',
      ].join(' ')}
    >
      {/* Achtergrondgloed-fallback terwijl de afbeelding laadt of ontbreekt. */}
      <div
        className={[
          'absolute inset-0 bg-gradient-to-br from-diepteal-600/40 to-antraciet-700 transition-opacity duration-500',
          loaded ? 'opacity-0' : hasImage ? 'opacity-100 animate-pulse-soft' : 'opacity-100',
        ].join(' ')}
      />

      {/* Titel groot in beeld wanneer er geen logo/poster is. */}
      {!hasImage && (
        <div className="absolute inset-0 grid place-items-center p-3 text-center">
          <span className="line-clamp-3 text-sm font-bold text-mist/90">{item.title}</span>
        </div>
      )}

      {hasImage && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={[
            'h-full w-full object-cover transition-[opacity,transform] duration-500',
            loaded ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        />
      )}

      {/* Onderscrim voor leesbaarheid van titels/badges. */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-antraciet-900/95 via-antraciet-900/40 to-transparent" />

      {/* Linksboven gestapeld: live-indicator + afspeelbaarheids-waarschuwing. */}
      <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
        {isLive && item.isLiveNow && (
          <span className="flex items-center gap-1.5 rounded-md bg-antraciet-900/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-mist backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse-soft" />
            Live
          </span>
        )}
        <PlayabilityBadge item={item} />
      </div>
      {isLive && item.channelBadge && (
        <span className="absolute right-2.5 top-2.5 grid h-8 min-w-8 place-items-center rounded-md bg-buisgroen/90 px-1.5 text-xs font-extrabold text-antraciet-900">
          {item.channelBadge}
        </span>
      )}

      {/* Titel / context onderaan */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 text-left">
        <p className="line-clamp-1 text-sm font-semibold text-mist">{item.title}</p>
        {item.tagline && (
          <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-mist-400">{item.tagline}</p>
        )}
        {!item.tagline && item.year && (
          <p className="mt-0.5 text-[11px] font-medium text-mist-400">
            {item.year}
            {item.rating ? ` · ${item.rating}+` : ''}
          </p>
        )}
      </div>

      {/* Voortgangsbalk (Verder kijken) */}
      {showProgress && item.progress != null && (
        <div className="absolute inset-x-2.5 bottom-2 h-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-buisgroen"
            style={{ width: `${Math.round(item.progress * 100)}%` }}
          />
        </div>
      )}

      {/* Hover-play affordance */}
      <span className="pointer-events-none absolute right-2.5 bottom-2.5 grid h-9 w-9 translate-y-1 place-items-center rounded-full bg-buisgroen text-antraciet-900 opacity-0 shadow-glow transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
      </span>
    </button>
  )
}
