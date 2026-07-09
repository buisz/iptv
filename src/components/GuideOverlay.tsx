import { useEffect, useRef, useState } from 'react'
import type { MediaItem } from '../types/content'
import type { Source } from '../types/source'
import { lockScroll, unlockScroll } from '../lib/scrollLock'
import { useLazyChannelEpg, pickNowNext } from '../hooks/useLazyChannelEpg'
import { useImgFallback } from '../hooks/useImgFallback'
import { useVirtualRows } from '../hooks/useVirtualRows'
import { clock } from '../lib/time'
import { useT } from '../i18n'

interface GuideOverlayProps {
  open: boolean
  channels: MediaItem[]
  source: Source
  onClose: () => void
  onOpen: (item: MediaItem) => void
}

/** Hoogte van één rij (kaart + gap) — moet kloppen met de opmaak voor de virtualisatie. */
const ROW_H = 96

function ChannelRow({ ch, source, onOpen }: { ch: MediaItem; source: Source; onOpen: (i: MediaItem) => void }) {
  const t = useT()
  const ref = useRef<HTMLButtonElement>(null)
  const epg = useLazyChannelEpg(ref, ch, source)
  const now = Date.now()
  const { now: cur, next } = pickNowNext(epg, now)
  const { src: logo, failed: logoFailed, onError: onLogoError } = useImgFallback(ch.poster || ch.backdrop)
  const fraction =
    cur && cur.stop > cur.start ? Math.min(1, Math.max(0, (now - cur.start) / (cur.stop - cur.start))) : 0

  return (
    <button
      ref={ref}
      onClick={() => onOpen(ch)}
      style={{ height: ROW_H - 10 }}
      className="flex w-full items-center gap-4 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-colors hover:border-buisgroen/40 hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
    >
      <span className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-antraciet-700 ring-1 ring-white/10">
        {logo && !logoFailed ? (
          <img src={logo} alt="" loading="lazy" onError={onLogoError} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs font-extrabold text-buisgroen">{ch.channelBadge ?? ch.title.slice(0, 3)}</span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-mist">{ch.title}</span>
          {ch.isLiveNow && (
            <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse-soft" /> {t('common.live')}
            </span>
          )}
        </span>

        {epg === null ? (
          <span className="mt-1 block h-3 w-40 animate-pulse-soft rounded bg-white/[0.06]" />
        ) : cur ? (
          <>
            <span className="mt-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-xs text-mist-400">
                <span className="font-semibold text-buisgroen">{t('detail.now')}</span> · {cur.title}
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
                {t('detail.next')} · {next.title} ({clock(next.start)})
              </span>
            )}
          </>
        ) : (
          <span className="mt-1 block text-xs text-mist-300">{ch.tagline || t('guide.noInfo')}</span>
        )}
      </span>
    </button>
  )
}

export default function GuideOverlay({ open, channels, source, onClose, onOpen }: GuideOverlayProps) {
  const t = useT()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(1)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    lockScroll()
    return () => {
      window.removeEventListener('keydown', onKey)
      unlockScroll()
    }
  }, [open, onClose])

  // Kolommen volgen de `sm`-breakpoint (Tailwind: 640px) — moet matchen met sm:grid-cols-2.
  useEffect(() => {
    if (!open) return
    const mq = window.matchMedia('(min-width: 640px)')
    const apply = () => setColumns(mq.matches ? 2 : 1)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [open])

  const { start, end, totalHeight, offsetTop } = useVirtualRows(scrollRef, {
    count: channels.length,
    rowHeight: ROW_H,
    columns,
    overscan: 3,
  })

  if (!open) return null

  const visible = channels.slice(start, end)

  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-antraciet-900/95 backdrop-blur-md animate-fade-in">
      <div className="edge-x flex items-center justify-between gap-3 border-b border-white/[0.06] py-4">
        <div>
          <h2 className="text-lg font-bold text-mist">{t('guide.title')}</h2>
          <p className="text-xs text-mist-400">{t('guide.channels', { n: channels.length })}</p>
        </div>
        <button
          onClick={onClose}
          aria-label={t('common.close')}
          className="grid h-10 w-10 place-items-center rounded-full text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-mist focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-5">
        {channels.length === 0 ? (
          <p className="edge-x text-sm text-mist-400">{t('guide.noChannels')}</p>
        ) : (
          <div className="edge-x" style={{ height: totalHeight, position: 'relative' }}>
            <div
              className="grid gap-2.5 sm:grid-cols-2"
              style={{ position: 'absolute', top: offsetTop, left: 0, right: 0 }}
            >
              {visible.map((ch, i) => (
                <ChannelRow key={`${ch.id}-${start + i}`} ch={ch} source={source} onOpen={onOpen} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
