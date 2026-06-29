import { useEffect, useRef, useState } from 'react'
import type { MediaKind } from '../types/content'

export interface PlayRequest {
  title: string
  /** Directe afspeel-URL. Bij de demo-bron ontbreekt deze. */
  url?: string
  kind: MediaKind
}

interface PlayerProps {
  request: PlayRequest | null
  onClose: () => void
}

type Status = 'idle' | 'loading' | 'playing' | 'error' | 'demo'

function isHls(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url)
}
function isMpegTs(url: string): boolean {
  // .ts of Xtream-live zonder extensie (…/u/p/123).
  return /\.ts(\?|$)/i.test(url) || /\/live\//i.test(url) || /\/\d+$/.test(url)
}

export default function Player({ request, onClose }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cleanupRef = useRef<() => void>(() => {})
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  // Escape sluit; body-scroll vergrendelen zolang open.
  useEffect(() => {
    if (!request) return
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
  }, [request, onClose])

  // Bron koppelen / engine kiezen.
  useEffect(() => {
    cleanupRef.current()
    cleanupRef.current = () => {}

    if (!request) return
    const video = videoRef.current
    const url = request.url

    if (!url) {
      setStatus('demo')
      return
    }
    if (!video) return

    let cancelled = false
    setStatus('loading')
    setMessage('')

    const fail = (msg: string) => {
      if (!cancelled) {
        setStatus('error')
        setMessage(msg)
      }
    }

    async function attach() {
      try {
        if (isHls(url!) && !video!.canPlayType('application/vnd.apple.mpegurl')) {
          // HLS via hls.js (browsers zonder native HLS).
          const Hls = (await import('hls.js')).default
          if (cancelled) return
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true })
            hls.loadSource(url!)
            hls.attachMedia(video!)
            hls.on(Hls.Events.ERROR, (_e, data) => {
              if (data.fatal) fail(corsHint('HLS-stream kon niet geladen worden.'))
            })
            cleanupRef.current = () => hls.destroy()
            return
          }
        }

        if (isMpegTs(url!) && !isHls(url!)) {
          // MPEG-TS via mpegts.js (typische Xtream-live).
          const mpegts = (await import('mpegts.js')).default
          if (cancelled) return
          if (mpegts.isSupported()) {
            const player = mpegts.createPlayer(
              { type: 'mpegts', isLive: request!.kind === 'live', url: url! },
              { enableWorker: true, liveBufferLatencyChasing: request!.kind === 'live' },
            )
            player.attachMediaElement(video!)
            player.on(mpegts.Events.ERROR, () =>
              fail(corsHint('MPEG-TS-stream kon niet geladen worden.')),
            )
            player.load()
            cleanupRef.current = () => {
              player.destroy()
            }
            return
          }
        }

        // Native fallback (native HLS op Safari, of progressieve MP4 e.d.).
        video!.src = url!
        cleanupRef.current = () => {
          video!.removeAttribute('src')
          video!.load()
        }
      } catch {
        fail('Afspeelmotor kon niet geladen worden.')
      }
    }

    void attach()
    const onPlaying = () => !cancelled && setStatus('playing')
    const onErr = () => fail(corsHint('Deze stream speelt niet af in de browser.'))
    video.addEventListener('playing', onPlaying)
    video.addEventListener('error', onErr)

    return () => {
      cancelled = true
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('error', onErr)
      cleanupRef.current()
      cleanupRef.current = () => {}
    }
  }, [request])

  if (!request) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Speler — ${request.title}`}
      className="fixed inset-0 z-[70] flex flex-col bg-black animate-fade-in"
    >
      <div className="flex items-center justify-between gap-4 bg-gradient-to-b from-black/80 to-transparent px-[var(--edge)] py-4">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-mist">{request.title}</p>
          <p className="text-xs text-mist-300">
            {request.kind === 'live' ? 'Live' : request.kind === 'series' ? 'Serie' : 'Film'}
            {status === 'playing' && ' · speelt af'}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Speler sluiten"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-mist transition-colors hover:bg-white/20 hover:text-buisgroen focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        <video
          ref={videoRef}
          className="max-h-full max-w-full"
          controls
          autoPlay
          playsInline
        />

        {status === 'loading' && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="h-12 w-12 animate-spin rounded-full border-[3px] border-white/20 border-t-buisgroen" />
          </div>
        )}

        {(status === 'error' || status === 'demo') && (
          <div className="absolute inset-0 grid place-items-center p-6">
            <div className="max-w-md rounded-2xl border border-white/10 bg-antraciet-800/90 p-6 text-center backdrop-blur">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-buisgroen/15 text-buisgroen">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v4m0 4h.01M10.3 3.9 2 18a1.7 1.7 0 0 0 1.5 2.5h17A1.7 1.7 0 0 0 22 18L13.7 3.9a1.7 1.7 0 0 0-3 0Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              {status === 'demo' ? (
                <>
                  <h3 className="text-lg font-bold text-mist">Demo-item</h3>
                  <p className="mt-2 text-sm leading-relaxed text-mist-400">
                    Dit is mockdata zonder echte stream. Laad een eigen M3U-playlist of
                    Xtream-account om te kunnen afspelen.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-mist">Afspelen lukt niet</h3>
                  <p className="mt-2 text-sm leading-relaxed text-mist-400">{message}</p>
                </>
              )}
              <button
                onClick={onClose}
                className="mt-5 rounded-full bg-buisgroen px-6 py-2.5 text-sm font-bold text-antraciet-900 outline-none focus-visible:ring-2 focus-visible:ring-buisgroen"
              >
                Sluiten
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function corsHint(base: string): string {
  return (
    `${base} In een browser blokkeert CORS vaak directe IPTV-streams. ` +
    `Op de doel-box (Android TV / Fire Stick) of achter een proxy speelt dit wél af.`
  )
}
