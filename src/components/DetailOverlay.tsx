import { useEffect, useRef, useState } from 'react'
import type { MediaItem } from '../types/content'

interface DetailOverlayProps {
  item: MediaItem | null
  onClose: () => void
  onPlay: (req: { title: string; url?: string; kind: MediaItem['kind'] }) => void
}

const kindLabel: Record<MediaItem['kind'], string> = {
  live: 'Live-kanaal',
  movie: 'Film',
  series: 'Serie',
}

export default function DetailOverlay({ item, onClose, onPlay }: DetailOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [activeSeason, setActiveSeason] = useState(0)

  // Sluiten met Escape + scroll van de body vergrendelen zolang open.
  useEffect(() => {
    if (!item) return
    setActiveSeason(0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Focus de panel-container voor toetsenbordgebruikers.
    panelRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [item, onClose])

  if (!item) return null

  const season = item.seasons?.[activeSeason]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-antraciet-900/80 p-4 backdrop-blur-md animate-fade-in sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative my-6 w-full max-w-3xl overflow-hidden rounded-[var(--radius-lg)] bg-antraciet-800 shadow-2xl ring-1 ring-white/10 animate-scale-in outline-none"
      >
        {/* Sluitknop */}
        <button
          onClick={onClose}
          aria-label="Sluiten"
          className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-antraciet-900/70 text-mist backdrop-blur-sm transition-colors hover:bg-antraciet-900 hover:text-buisgroen focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>

        {/* Backdrop / "trailer"-vlak */}
        <div className="relative aspect-video w-full">
          {item.backdrop ? (
            <img src={item.backdrop} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-diepteal-600/50 via-antraciet-700 to-antraciet-800" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-antraciet-800 via-antraciet-800/40 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6">
            <div>
              <span className="mb-2 inline-block rounded-full bg-buisgroen/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-buisgroen">
                {kindLabel[item.kind]}
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-mist sm:text-4xl">
                {item.title}
              </h2>
            </div>
            <button
              onClick={() => onPlay({ title: item.title, url: item.streamUrl, kind: item.kind })}
              className="hidden shrink-0 items-center gap-2 rounded-full bg-buisgroen px-5 py-2.5 text-sm font-bold text-antraciet-900 shadow-glow transition-transform hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-buisgroen outline-none sm:flex"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
              {item.kind === 'live' ? 'Kijk live' : 'Afspelen'}
            </button>
          </div>
        </div>

        {/* Inhoud */}
        <div className="space-y-6 p-6">
          {/* Afspeelknop (mobiel; desktop heeft de knop in de header) */}
          <button
            onClick={() => onPlay({ title: item.title, url: item.streamUrl, kind: item.kind })}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-buisgroen px-5 py-3 text-sm font-bold text-antraciet-900 shadow-glow outline-none focus-visible:ring-2 focus-visible:ring-buisgroen sm:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
            {item.kind === 'live' ? 'Kijk live' : 'Afspelen'}
          </button>

          {/* Metadata-regel */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-mist-400">
            {item.score != null && (
              <span className="font-semibold text-buisgroen">★ {item.score.toFixed(1)}</span>
            )}
            {item.year && <span>{item.year}</span>}
            {item.durationMin && <span>{item.durationMin} min</span>}
            {item.rating && (
              <span className="rounded border border-white/20 px-1.5 py-0.5 text-xs">
                {item.rating}+
              </span>
            )}
            {item.isLiveNow && (
              <span className="flex items-center gap-1.5 font-semibold text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse-soft" /> Live nu
              </span>
            )}
          </div>

          <p className="max-w-2xl text-balance text-[15px] leading-relaxed text-mist-500">
            {item.synopsis}
          </p>

          {/* Genres */}
          {item.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-mist-400"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Cast */}
          {item.cast && item.cast.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-mist-300">
                Met
              </h3>
              <p className="text-sm text-mist-500">{item.cast.join(' · ')}</p>
            </div>
          )}

          {/* Afleveringen (series) */}
          {item.seasons && item.seasons.length > 0 && season && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-mist">Afleveringen</h3>
                {item.seasons.length > 1 && (
                  <div className="flex gap-1.5">
                    {item.seasons.map((s, i) => (
                      <button
                        key={s.seasonNumber}
                        onClick={() => setActiveSeason(i)}
                        className={[
                          'rounded-full px-3 py-1 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-buisgroen',
                          i === activeSeason
                            ? 'bg-buisgroen text-antraciet-900'
                            : 'bg-white/[0.05] text-mist-400 hover:text-mist',
                        ].join(' ')}
                      >
                        S{s.seasonNumber}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.06]">
                {season.episodes.map((ep) => (
                  <li key={ep.id}>
                    <button
                      onClick={() =>
                        onPlay({
                          title: `${item.title} — ${ep.title}`,
                          url: ep.streamUrl,
                          kind: 'series',
                        })
                      }
                      className="flex w-full items-center gap-4 p-3.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-buisgroen outline-none"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-antraciet-600 text-sm font-bold text-mist-400">
                        {ep.episodeNumber}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-mist">{ep.title}</span>
                          <span className="shrink-0 text-xs text-mist-300">{ep.durationMin} min</span>
                        </span>
                        <span className="mt-0.5 line-clamp-1 text-xs text-mist-400">{ep.synopsis}</span>
                      </span>
                      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-buisgroen" fill="currentColor" aria-hidden="true">
                        <path d="M8 5.5v13l11-6.5z" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fase-2 hint */}
          <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-mist-300">
            Dit is een visueel prototype met demodata. In fase 2 worden afspelen,
            trailers en metadata gekoppeld aan je eigen M3U-playlist of Xtream-account.
          </p>
        </div>
      </div>
    </div>
  )
}
