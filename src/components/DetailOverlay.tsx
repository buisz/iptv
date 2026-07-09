import { useEffect, useRef, useState } from 'react'
import type { EpgEntry, MediaItem } from '../types/content'
import type { PlayRequest } from './Player'
import { lockScroll, unlockScroll } from '../lib/scrollLock'
import { isFavorite, toggleFavorite } from '../api/favorites'
import { useT } from '../i18n'
import PlayabilityBadge from './PlayabilityBadge'
import { clock as clockTime, fmtTime } from '../lib/time'

interface DetailOverlayProps {
  item: MediaItem | null
  onClose: () => void
  onPlay: (req: PlayRequest) => void
}

const kindLabel: Record<MediaItem['kind'], string> = {
  live: 'Live-kanaal',
  movie: 'Film',
  series: 'Serie',
}

const clock = clockTime

export default function DetailOverlay({ item, onClose, onPlay }: DetailOverlayProps) {
  const t = useT()
  const panelRef = useRef<HTMLDivElement>(null)
  const [activeSeason, setActiveSeason] = useState(0)
  const [fav, setFav] = useState(false)

  // Sluiten met Escape + scroll van de body vergrendelen zolang open.
  useEffect(() => {
    if (!item) return
    setActiveSeason(0)
    setFav(isFavorite(item.id))
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    lockScroll()
    // Focus de panel-container voor toetsenbordgebruikers.
    panelRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      unlockScroll()
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
              onClick={() =>
                onPlay({
                  title: item.title,
                  url: item.streamUrl,
                  kind: item.kind,
                  id: item.id,
                  poster: item.poster,
                  backdrop: item.backdrop,
                })
              }
              className="hidden shrink-0 items-center gap-2 rounded-full bg-buisgroen px-5 py-2.5 text-sm font-bold text-antraciet-900 shadow-glow transition-transform hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-buisgroen outline-none sm:flex"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
              {item.kind === 'live' ? t('detail.watchLive') : t('detail.play')}
            </button>
          </div>
        </div>

        {/* Inhoud */}
        <div className="space-y-6 p-6">
          {/* Acties: afspelen (mobiel) + Mijn lijst */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() =>
                onPlay({
                  title: item.title,
                  url: item.streamUrl,
                  kind: item.kind,
                  id: item.id,
                  poster: item.poster,
                  backdrop: item.backdrop,
                })
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-buisgroen px-5 py-3 text-sm font-bold text-antraciet-900 shadow-glow outline-none focus-visible:ring-2 focus-visible:ring-buisgroen sm:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
              {item.kind === 'live' ? t('detail.watchLive') : t('detail.play')}
            </button>

            <button
              onClick={() => setFav(toggleFavorite(item))}
              aria-pressed={fav}
              className={[
                'flex shrink-0 items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-buisgroen sm:py-2.5',
                fav
                  ? 'border-buisgroen/60 bg-buisgroen/10 text-buisgroen'
                  : 'border-white/15 text-mist hover:bg-white/[0.06]',
              ].join(' ')}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                {fav ? (
                  <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                )}
              </svg>
              {fav ? t('detail.inMyList') : t('detail.myList')}
            </button>
          </div>

          {/* Herkomst / per-bron afspelen (alleen in de samengevoegde weergave). */}
          {item.sourceName && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-mist-400">
              {item.altSources?.length ? (
                <>
                  <span className="font-semibold uppercase tracking-wider text-mist-300">{t('detail.playVia')}</span>
                  {[
                    { sourceId: item.sourceId!, sourceName: item.sourceName, streamUrl: item.streamUrl },
                    ...item.altSources,
                  ].map((s, i) => (
                    <button
                      key={`${s.sourceId}-${i}`}
                      onClick={() =>
                        onPlay({
                          title: item.title,
                          url: s.streamUrl,
                          kind: item.kind,
                          id: item.id,
                          poster: item.poster,
                          backdrop: item.backdrop,
                        })
                      }
                      className="rounded-full border border-white/15 px-2.5 py-1 font-semibold text-mist transition-colors hover:border-buisgroen/50 hover:bg-buisgroen/[0.08] hover:text-buisgroen focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
                    >
                      {s.sourceName}
                    </button>
                  ))}
                </>
              ) : (
                <span>
                  <span className="font-semibold uppercase tracking-wider text-mist-300">{t('detail.source')}</span> · {item.sourceName}
                </span>
              )}
            </div>
          )}

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
            {item.quality?.res && (
              <span className="rounded border border-white/20 px-1.5 py-0.5 text-xs uppercase">
                {item.quality.res === '4k' ? '4K' : item.quality.res.toUpperCase()}
              </span>
            )}
          </div>

          {/* Afspeelbaarheid op dit apparaat (codec × hardware) */}
          <PlayabilityBadge item={item} variant="inline" />

          {item.synopsis && (
            <p className="max-w-2xl text-balance text-[15px] leading-relaxed text-mist-500">
              {item.synopsis}
            </p>
          )}

          {/* EPG: nu + verticale tijdlijn van wat er straks komt (live) */}
          {item.kind === 'live' &&
            (() => {
              const now = Date.now()
              const sched =
                item.epgSchedule && item.epgSchedule.length
                  ? item.epgSchedule
                  : ([item.epgNow, item.epgNext].filter(Boolean) as EpgEntry[])
              if (!sched.length) return null
              const current =
                sched
                  .filter((p) => p.start <= now && p.stop > now)
                  .sort((a, b) => a.start - b.start)
                  .pop() ?? item.epgNow
              const upcoming = sched
                .filter((p) => p.start > now)
                .sort((a, b) => a.start - b.start)
                .filter((p, i, a) => i === 0 || p.title !== a[i - 1].title)
              return (
                <div className="space-y-2">
                  {current && (
                    <div className="flex items-start gap-3 rounded-xl border border-buisgroen/20 bg-buisgroen/[0.06] p-3">
                      <span className="mt-0.5 shrink-0 rounded bg-buisgroen px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-antraciet-900">
                        {t('detail.now')}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-mist">{current.title}</p>
                        <p className="text-xs text-mist-400">
                          {clock(current.start)} – {clock(current.stop)}
                        </p>
                      </div>
                    </div>
                  )}
                  {upcoming.length > 0 && (
                    <div>
                      <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-mist-300">
                        {t('detail.next')}
                      </p>
                      <ul className="max-h-64 divide-y divide-white/[0.06] overflow-y-auto rounded-xl border border-white/[0.06]">
                        {upcoming.map((p, i) => (
                          <li key={i} className="flex items-center gap-3 px-3 py-2">
                            <span className="shrink-0 text-xs font-semibold text-mist-400">
                              {fmtTime(p.start, now)}
                            </span>
                            <span className="min-w-0 truncate text-sm text-mist">{p.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })()}

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
                {t('detail.with')}
              </h3>
              <p className="text-sm text-mist-500">{item.cast.join(' · ')}</p>
            </div>
          )}

          {/* Afleveringen (series) */}
          {item.seasons && item.seasons.length > 0 && season && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-mist">{t('detail.episodes')}</h3>
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
                          id: ep.id,
                          poster: item.poster,
                          backdrop: item.backdrop,
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

          {/* Demo-hint — alleen bij de demobron (echte items hebben een streamUrl). */}
          {!item.streamUrl && !item.seasons && (
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-mist-300">
              Dit is een visueel prototype met demodata. Laad je eigen M3U-playlist of
              Xtream-account om echt af te spelen.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
