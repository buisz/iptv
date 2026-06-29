import { useEffect, useMemo } from 'react'
import type { MediaItem } from '../types/content'

interface GuideOverlayProps {
  open: boolean
  channels: MediaItem[]
  onClose: () => void
  onOpen: (item: MediaItem) => void
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function ChannelRow({ ch, now, onOpen }: { ch: MediaItem; now: number; onOpen: (i: MediaItem) => void }) {
  const cur = ch.epgNow
  const next = ch.epgNext
  const fraction =
    cur && cur.stop > cur.start ? Math.min(1, Math.max(0, (now - cur.start) / (cur.stop - cur.start))) : 0

  return (
    <button
      onClick={() => onOpen(ch)}
      className="flex w-full items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-colors hover:border-buisgroen/40 hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
    >
      {/* Zender-merk/logo */}
      <span className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-antraciet-700 ring-1 ring-white/10">
        {ch.poster ? (
          <img src={ch.poster} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-extrabold text-buisgroen">{ch.channelBadge ?? ch.title.slice(0, 3)}</span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-mist">{ch.title}</span>
          {ch.isLiveNow && (
            <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse-soft" /> Live
            </span>
          )}
        </span>

        {cur ? (
          <>
            <span className="mt-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-xs text-mist-400">
                <span className="font-semibold text-buisgroen">Nu</span> · {cur.title}
              </span>
              <span className="shrink-0 text-[11px] text-mist-300">
                {clock(cur.start)}–{clock(cur.stop)}
              </span>
            </span>
            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full bg-buisgroen" style={{ width: `${Math.round(fraction * 100)}%` }} />
            </span>
            {next && (
              <span className="mt-1 block truncate text-[11px] text-mist-300">
                Straks · {next.title} ({clock(next.start)})
              </span>
            )}
          </>
        ) : (
          <span className="mt-1 block text-xs text-mist-300">
            {ch.tagline || 'Geen gidsinformatie beschikbaar'}
          </span>
        )}
      </span>
    </button>
  )
}

export default function GuideOverlay({ open, channels, onClose, onOpen }: GuideOverlayProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  // Eén tijdstip voor alle voortgangsbalken (stabiel binnen één render).
  const now = useMemo(() => Date.now(), [open])
  const hasEpg = useMemo(() => channels.some((c) => c.epgNow), [channels])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-antraciet-900/95 backdrop-blur-md animate-fade-in">
      <div className="edge-x flex items-center justify-between gap-3 border-b border-white/[0.06] py-4">
        <div>
          <h2 className="text-lg font-bold text-mist">TV-gids</h2>
          <p className="text-xs text-mist-400">
            {channels.length} zenders{hasEpg ? '' : ' · laad een EPG-bron voor nu/straks'}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Sluiten"
          className="grid h-10 w-10 place-items-center rounded-full text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-mist focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-5">
        {channels.length === 0 ? (
          <p className="edge-x text-sm text-mist-400">Geen live-zenders in de actieve bron.</p>
        ) : (
          <div className="edge-x grid gap-2.5 sm:grid-cols-2">
            {channels.map((ch, i) => (
              <ChannelRow key={`${ch.id}-${i}`} ch={ch} now={now} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
