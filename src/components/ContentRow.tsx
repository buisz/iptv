import { useRef } from 'react'
import type { ContentRowData, MediaItem } from '../types/content'
import PosterCard from './PosterCard'

interface ContentRowProps {
  row: ContentRowData
  /** Globale rij-index voor spatial navigation. */
  rowIndex: number
  onOpen: (item: MediaItem) => void
  onFavoriteChange?: () => void
}

export default function ContentRow({ row, rowIndex, onOpen, onFavoriteChange }: ContentRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)

  function nudge(dir: 1 | -1) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <section className="group/row relative" aria-labelledby={`row-${row.id}`}>
      <div className="edge-x mb-3 flex items-baseline justify-between">
        <h2 id={`row-${row.id}`} className="text-base font-bold tracking-tight text-mist sm:text-lg">
          {row.title}
        </h2>
        <span className="text-xs font-medium text-mist-300">{row.items.length}</span>
      </div>

      <div className="relative">
        {/* Scroll-knoppen (desktop, op hover van de rij). */}
        <button
          aria-label="Naar links"
          onClick={() => nudge(-1)}
          className="absolute left-1 top-0 bottom-0 z-20 hidden w-12 place-items-center bg-gradient-to-r from-antraciet-900/80 to-transparent text-mist opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-buisgroen focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-buisgroen outline-none md:grid"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div
          ref={scrollerRef}
          className="row-scroll edge-x flex gap-3 overflow-x-auto scroll-px-[var(--edge)] pb-2 pt-1 sm:gap-4"
        >
          {row.items.map((item, col) => (
            <PosterCard
              key={`${row.id}-${item.id}-${col}`}
              item={item}
              row={rowIndex}
              col={col}
              showProgress={row.showProgress}
              onOpen={onOpen}
              onFavoriteChange={onFavoriteChange}
            />
          ))}
        </div>

        <button
          aria-label="Naar rechts"
          onClick={() => nudge(1)}
          className="absolute right-1 top-0 bottom-0 z-20 hidden w-12 place-items-center bg-gradient-to-l from-antraciet-900/80 to-transparent text-mist opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-buisgroen focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-buisgroen outline-none md:grid"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </section>
  )
}
