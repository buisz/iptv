import { useEffect, useMemo, useRef, useState } from 'react'
import type { MediaItem } from '../types/content'
import PosterCard from './PosterCard'
import { lockScroll, unlockScroll } from '../lib/scrollLock'

interface SearchOverlayProps {
  open: boolean
  items: MediaItem[]
  onClose: () => void
  onOpen: (item: MediaItem) => void
}

const kindLabel: Record<MediaItem['kind'], string> = {
  live: 'Live',
  movie: 'Film',
  series: 'Serie',
}

export default function SearchOverlay({ open, items, onClose, onOpen }: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    lockScroll()
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      unlockScroll()
    }
  }, [open, onClose])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const scored: { item: MediaItem; score: number }[] = []
    for (const item of items) {
      const title = item.title.toLowerCase()
      let score = -1
      if (title.startsWith(q)) score = 0
      else if (title.includes(q)) score = 1
      else if (item.genres.some((g) => g.toLowerCase().includes(q))) score = 2
      if (score >= 0) scored.push({ item, score })
    }
    return scored
      .sort((a, b) => a.score - b.score || a.item.title.localeCompare(b.item.title))
      .slice(0, 60)
      .map((s) => s.item)
  }, [query, items])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-antraciet-900/95 backdrop-blur-md animate-fade-in">
      <div className="edge-x flex items-center gap-3 border-b border-white/[0.06] py-4">
        <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-mist-400" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek films, series, zenders…"
          className="flex-1 bg-transparent text-lg font-medium text-mist placeholder:text-mist-300 outline-none"
        />
        <button
          onClick={onClose}
          aria-label="Sluiten"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-mist focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-6">
        {query.trim().length < 2 ? (
          <p className="edge-x text-sm text-mist-400">Typ minstens 2 tekens om te zoeken in je bibliotheek.</p>
        ) : results.length === 0 ? (
          <p className="edge-x text-sm text-mist-400">Geen resultaten voor "{query}".</p>
        ) : (
          <>
            <p className="edge-x mb-4 text-xs font-medium text-mist-300">{results.length} resultaten</p>
            <div className="edge-x flex flex-wrap gap-3 sm:gap-4">
              {results.map((item, i) => (
                <div key={`${item.id}-${i}`} className="relative shrink-0">
                  <PosterCard item={item} row={0} col={i} onOpen={onOpen} />
                  <span className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-antraciet-900/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-mist-400 backdrop-blur-sm">
                    {kindLabel[item.kind]}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
