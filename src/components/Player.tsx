import { useEffect, useRef, useState } from 'react'
import type { MediaKind } from '../types/content'
import { castMedia, initCast, onCastAvailability } from '../api/cast'
import { resumePosition, saveProgress } from '../api/progress'
import { lockScroll, unlockScroll } from '../lib/scrollLock'
import { proxied } from '../api/proxy'
import {
  nativePlay,
  nativeProgress,
  nativeStop,
  nativeVideoAvailable,
  onNativeExit,
} from '../api/player/nativeVideo'

export interface PlayRequest {
  title: string
  /** Directe afspeel-URL. Bij de demo-bron ontbreekt deze. */
  url?: string
  kind: MediaKind
  /** Item-id voor "Verder kijken" (voortgang opslaan/hervatten). */
  id?: string
  poster?: string
  backdrop?: string
}

interface PlayerProps {
  request: PlayRequest | null
  onClose: () => void
}

type Status = 'idle' | 'loading' | 'playing' | 'error' | 'demo' | 'native'

function isHls(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url)
}
function isMpegTs(url: string): boolean {
  // .ts of Xtream-live zonder extensie (…/u/p/123).
  return /\.ts(\?|$)/i.test(url) || /\/live\//i.test(url) || /\/\d+$/.test(url)
}

const NATIVE = nativeVideoAvailable()

export default function Player({ request, onClose }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cleanupRef = useRef<() => void>(() => {})
  // Altijd de actuele onClose voor de native exit-callback.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  // Chromecast (CAF) beschikbaar in deze browser? AirPlay (WebKit) beschikbaar?
  const [castAvailable, setCastAvailable] = useState(false)
  const [airplayAvailable, setAirplayAvailable] = useState(false)

  // Chromecast — CAF Web Sender: alleen actief in echte Chrome-browsers.
  function castNow() {
    if (request?.url) void castMedia(request.url, request.title)
  }

  // AirPlay — moet SYNCHROON in de click-handler (anders verliest het de gesture).
  function airplayNow() {
    const v = videoRef.current as unknown as { webkitShowPlaybackTargetPicker?: () => void }
    v?.webkitShowPlaybackTargetPicker?.()
  }

  // Cast-SDK laden + beschikbaarheid volgen (no-op in WebView/Safari).
  useEffect(() => {
    initCast()
    return onCastAvailability(setCastAvailable)
  }, [])

  // AirPlay toestaan + beschikbaarheid van een AirPlay-doel volgen (WebKit-only).
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.setAttribute('x-webkit-airplay', 'allow')
    const onAvail = (e: Event) => {
      const availability = (e as unknown as { availability?: string }).availability
      setAirplayAvailable(availability === 'available')
    }
    v.addEventListener('webkitplaybacktargetavailabilitychanged', onAvail as EventListener)
    return () =>
      v.removeEventListener('webkitplaybacktargetavailabilitychanged', onAvail as EventListener)
  }, [request])

  // "Verder kijken": positie bewaren (throttled) + hervatten bij laden.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !request?.id || request.kind === 'live') return
    const id = request.id
    const persist = () =>
      saveProgress({
        id,
        kind: request.kind,
        title: request.title,
        poster: request.poster,
        backdrop: request.backdrop,
        streamUrl: request.url,
        positionSec: v.currentTime,
        durationSec: v.duration,
      })

    const onMeta = () => {
      const pos = resumePosition(id)
      if (pos && pos < v.duration - 5) {
        try {
          v.currentTime = pos
        } catch {
          /* seek niet mogelijk vóór buffer — negeer */
        }
      }
    }
    let last = 0
    const onTime = () => {
      const now = Date.now()
      if (now - last < 5000) return
      last = now
      persist()
    }
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('timeupdate', onTime)
    return () => {
      persist() // laatste positie bij sluiten/wisselen
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('timeupdate', onTime)
    }
  }, [request])

  // Escape sluit; body-scroll vergrendelen zolang open.
  useEffect(() => {
    if (!request) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    lockScroll()
    return () => {
      window.removeEventListener('keydown', onKey)
      unlockScroll()
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

    // Native app: speel af met de NATIVE speler (ExoPlayer/AVPlayer) — geen CORS,
    // hardware-decoding. De native speler dekt het scherm; onze overlay zit erachter
    // en sluit zodra de native speler dicht gaat.
    if (NATIVE) {
      setStatus('native')
      const id = request.id
      const kind = request.kind
      const title = request.title
      const poster = request.poster
      const backdrop = request.backdrop
      let unsub = () => {}
      let interval: ReturnType<typeof setInterval> | undefined
      void (async () => {
        unsub = await onNativeExit(() => onCloseRef.current())
        const startAt = id && kind !== 'live' ? resumePosition(id) : undefined
        const ok = await nativePlay({ url, title, startAt })
        if (!ok) {
          setStatus('error')
          setMessage('Native speler kon niet starten.')
          return
        }
        if (id && kind !== 'live') {
          interval = setInterval(async () => {
            const pr = await nativeProgress()
            if (pr)
              saveProgress({ id, kind, title, poster, backdrop, streamUrl: url, positionSec: pr.position, durationSec: pr.duration })
          }, 5000)
        }
      })()
      cleanupRef.current = () => {
        unsub()
        if (interval) clearInterval(interval)
        void nativeStop()
      }
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
              // mpegts.js haalt de stream via fetch op → CORS. Via de proxy
              // (dev: /__proxy, web-deploy: VITE_PROXY_BASE) omzeilen we dat.
              { type: 'mpegts', isLive: request!.kind === 'live', url: proxied(url!) },
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
        <div className="flex shrink-0 items-center gap-2">
          {request.url && airplayAvailable && (
            <button
              onClick={airplayNow}
              aria-label="AirPlay"
              title="AirPlay (Apple TV / AirPlay-2-tv)"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-mist transition-colors hover:bg-white/20 hover:text-buisgroen focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 17H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-1" strokeLinecap="round" strokeLinejoin="round" />
                <path d="m12 15 5 6H7l5-6Z" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {request.url && castAvailable && (
            <button
              onClick={castNow}
              aria-label="Casten naar Chromecast/Google TV"
              title="Casten (Chromecast / Google TV)"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-mist transition-colors hover:bg-white/20 hover:text-buisgroen focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="3" cy="20" r="1" fill="currentColor" stroke="none" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Speler sluiten"
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-mist transition-colors hover:bg-white/20 hover:text-buisgroen focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <video
          ref={videoRef}
          className="h-full max-h-full w-full object-contain"
          controls
          autoPlay
          playsInline
        />

        {(status === 'loading' || status === 'native') && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center gap-3 text-center">
            <span className="h-12 w-12 animate-spin rounded-full border-[3px] border-white/20 border-t-buisgroen" />
            {status === 'native' && (
              <span className="text-sm text-mist-400">Speelt af in de native speler…</span>
            )}
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
