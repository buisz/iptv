import { useEffect, useRef, useState } from 'react'
import type { MediaKind } from '../types/content'
import { castMedia, initCast, onCastAvailability } from '../api/cast'
import { resumePosition, saveProgress } from '../api/progress'
import { lockScroll, unlockScroll } from '../lib/scrollLock'
import { proxied } from '../api/proxy'
import { useT } from '../i18n'
import HelpOverlay from './HelpOverlay'
import {
  nativePlay,
  nativeProgress,
  nativeStop,
  nativeVideoAvailable,
  onNativeExit,
} from '../api/player/nativeVideo'
import {
  AdaptiveBuffer,
  getBufferPreset,
  hlsConfig,
  mpegtsConfig,
  startProfile,
  type BufferProfile,
} from '../api/player/buffering'
import {
  geoBlockHint,
  geoBlockSuspected,
  recordStreamFailure,
  recordStreamSuccess,
  type FailCategory,
} from '../api/health'

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

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v == null ? fallback : v === '1'
  } catch {
    return fallback
  }
}
function readNum(key: string, fallback: number): number {
  try {
    const v = parseFloat(localStorage.getItem(key) ?? '')
    return isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback
  } catch {
    return fallback
  }
}

export default function Player({ request, onClose }: PlayerProps) {
  const t = useT()
  const videoRef = useRef<HTMLVideoElement>(null)
  const cleanupRef = useRef<() => void>(() => {})
  // Altijd de actuele onClose voor de native exit-callback.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  // Technische detailregel (zoals de browserconsole), achter een "Toon details"-knop.
  const [detail, setDetail] = useState('')
  const [showDetail, setShowDetail] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  // Niet-blokkerende melding als er geen afspeelbaar geluidsspoor is (bijv. AC-3).
  const [audioNote, setAudioNote] = useState('')
  // Chromecast (CAF) beschikbaar in deze browser? AirPlay (WebKit) beschikbaar?
  const [castAvailable, setCastAvailable] = useState(false)
  const [airplayAvailable, setAirplayAvailable] = useState(false)
  // Eigen volume/mute (betrouwbaarder dan alleen de native controls; TV-remote-vriendelijk).
  const [muted, setMuted] = useState(() => readBool('buisz.muted', false))
  const [volume, setVolumeState] = useState(() => readNum('buisz.volume', 1))

  function applyVolume(v: HTMLVideoElement) {
    v.muted = muted
    v.volume = volume
  }
  function toggleMute() {
    setMuted((m) => !m)
  }
  function changeVolume(val: number) {
    const clamped = Math.min(1, Math.max(0, val))
    setVolumeState(clamped)
    if (clamped > 0 && muted) setMuted(false)
  }

  // Volume/mute op het element toepassen + bewaren (ook bij bronwissel).
  useEffect(() => {
    const v = videoRef.current
    if (v) applyVolume(v)
    try {
      localStorage.setItem('buisz.muted', muted ? '1' : '0')
      localStorage.setItem('buisz.volume', String(volume))
    } catch {
      /* geen localStorage */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, volume, request, status])

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
    setDetail('')
    setShowDetail(false)
    setAudioNote('')

    const streamId = request.id
    // Toon de fout + registreer de categorie (voor de geo-/netwerkdiagnose). Bij een
    // netwerkfout én bewijs dat het account/API wél werkt, plakken we de geo-hint erbij.
    // `tech` is de ruwe technische regel (zoals de console) achter "Toon details".
    const fail = (msg: string, category: FailCategory = 'unknown', tech = '') => {
      if (cancelled) return
      recordStreamFailure(streamId, category)
      const full = category === 'network' && geoBlockSuspected() ? `${msg}\n\n${geoBlockHint()}` : msg
      setStatus('error')
      setMessage(full)
      setDetail([tech, url && `URL: ${url}`].filter(Boolean).join('\n'))
    }

    const preset = getBufferPreset()

    async function attachEngine(profile: BufferProfile) {
      try {
        if (isHls(url!) && !video!.canPlayType('application/vnd.apple.mpegurl')) {
          // HLS via hls.js (browsers zonder native HLS).
          const Hls = (await import('hls.js')).default
          if (cancelled) return
          if (Hls.isSupported()) {
            // hls.js haalt manifest én segmenten via fetch/XHR op → CORS. We routeren
            // ELK verzoek via de proxy. De proxy herschrijft m3u8-URI's naar absoluut,
            // zodat de segment-loader hier absolute URL's krijgt die we óók proxyen.
            const Base = Hls.DefaultConfig.loader as unknown as {
              new (config: unknown): { load(c: { url: string }, cfg: unknown, cb: unknown): void }
            }
            class ProxyLoader extends Base {
              load(context: { url: string }, config: unknown, callbacks: unknown) {
                if (context?.url) context.url = proxied(context.url, { stream: true })
                super.load(context, config, callbacks)
              }
            }
            const hls = new Hls({ enableWorker: true, loader: ProxyLoader as never, ...hlsConfig(profile) })
            hls.loadSource(url!)
            hls.attachMedia(video!)
            hls.on(Hls.Events.ERROR, (_e, data) => {
              if (!data.fatal) return
              const status = (data.response as { code?: number } | undefined)?.code
              const tech = `hls.js ${data.type} · ${data.details}${status ? ` · HTTP ${status}` : ''}`
              if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                fail(codecHint('HLS'), 'codec', tech)
              } else if (status && status >= 400 && status !== 502 && status !== 504) {
                fail(httpHint(status), httpCategory(status), tech)
              } else {
                // Geen provider-status (of onze proxy-502/504) → netwerklaag.
                fail(networkBase, 'network', tech)
              }
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
              // mpegts.js haalt de stream via fetch op → CORS. Via de proxy omzeilen we dat.
              { type: 'mpegts', isLive: request!.kind === 'live', url: proxied(url!, { stream: true }) },
              mpegtsConfig(profile),
            )
            player.attachMediaElement(video!)
            // Geen afspeelbaar geluidsspoor? (bijv. AC-3, dat mpegts.js niet demuxet
            // → hasAudio=false → de browser grijst de speaker uit). Toon een eerlijke,
            // niet-blokkerende melding i.p.v. de gebruiker te laten raden.
            player.on(mpegts.Events.MEDIA_INFO, () => {
              const mi = (player as { mediaInfo?: { hasAudio?: boolean; audioCodec?: string } }).mediaInfo
              if (!cancelled && mi && mi.hasAudio === false) {
                setAudioNote(t('player.noAudio'))
              }
            })
            player.on(
              mpegts.Events.ERROR,
              (errorType: string, errorDetail: string, info?: { code?: number; msg?: string }) => {
                const { msg, category } = mpegtsError(mpegts, errorType, errorDetail, info)
                const tech = `mpegts.js ${errorType} · ${errorDetail}${
                  info?.code ? ` · HTTP ${info.code}` : ''
                }${info?.msg ? ` · ${info.msg}` : ''}`
                fail(msg, category, tech)
              },
            )
            player.load()
            cleanupRef.current = () => {
              player.destroy()
            }
            return
          }
        }

        // Native fallback. Progressieve VOD (MP4/MKV e.d.) via de proxy: dat lost
        // 302-token-redirects, CORB (NotSameOrigin) en cross-origin op. Native HLS
        // (Safari) blijft direct — het video-element haalt HLS-segmenten CORS-vrij op.
        video!.src = isHls(url!) ? url! : proxied(url!, { stream: true })
        cleanupRef.current = () => {
          video!.removeAttribute('src')
          video!.load()
        }
      } catch (e) {
        fail('Afspeelmotor kon niet geladen worden.', 'unknown', String((e as Error)?.message || e))
      }
    }

    // Herbouw met een ander profiel (voor auto-escalatie bij live haperen).
    const rebuild = (profile: BufferProfile) => {
      cleanupRef.current()
      cleanupRef.current = () => {}
      void attachEngine(profile)
    }

    void attachEngine(startProfile(preset))

    // Auto-voorkeur op live: detecteer herhaald haperen → één keer opschalen naar SMOOTH.
    let adaptive: AdaptiveBuffer | undefined
    if (preset === 'auto' && request.kind === 'live') {
      adaptive = new AdaptiveBuffer(video, {
        onEscalate: () => {
          if (cancelled) return
          setStatus('loading')
          setMessage('')
          rebuild('SMOOTH')
        },
      })
    }

    const onPlaying = () => {
      if (cancelled) return
      recordStreamSuccess(streamId)
      setStatus('playing')
    }
    const onErr = () => {
      // MediaError-code: 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED.
      const code = video.error?.code
      const tech = `HTMLMediaElement MediaError code ${code ?? '?'}${
        video.error?.message ? ` · ${video.error.message}` : ''
      }`
      const m = url ? url.match(/\.(mkv|avi|wmv|flv)(\?|$)/i) : null
      if (m) fail(containerHint(m[1].toUpperCase()), 'container', tech)
      else if (code === 3 || code === 4) fail(codecHint('stream'), 'codec', tech)
      else if (code === 2) fail(networkBase, 'network', tech)
      else fail('Deze stream speelt niet af in de browser.', 'unknown', tech)
    }
    video.addEventListener('playing', onPlaying)
    video.addEventListener('error', onErr)

    return () => {
      cancelled = true
      adaptive?.destroy()
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
            {request.kind === 'live' ? t('player.live') : request.kind === 'series' ? t('player.serie') : t('player.film')}
            {status === 'playing' && ` · ${t('player.playing')}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {request.url && status !== 'native' && (
            <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2">
              <button
                onClick={toggleMute}
                aria-label={muted || volume === 0 ? t('player.unmute') : t('player.mute')}
                title={muted || volume === 0 ? t('player.unmute') : t('player.mute')}
                className="grid h-11 w-9 place-items-center text-mist transition-colors hover:text-buisgroen focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  {muted || volume === 0 ? (
                    <path d="M3.5 9v6h4l5 5V4l-5 5h-4zm13.7-.2 1.4 1.4L16.4 12l2.2 2.2-1.4 1.4L15 13.4l-2.2 2.2-1.4-1.4L13.6 12l-2.2-2.2 1.4-1.4L15 10.6l2.2-1.8z" />
                  ) : volume < 0.5 ? (
                    <path d="M3.5 9v6h4l5 5V4l-5 5h-4zm12 .2a3.5 3.5 0 0 1 0 5.6l-1.1-1.3a1.8 1.8 0 0 0 0-3l1.1-1.3z" />
                  ) : (
                    <path d="M3.5 9v6h4l5 5V4l-5 5h-4zm12 .2a3.5 3.5 0 0 1 0 5.6l-1.1-1.3a1.8 1.8 0 0 0 0-3l1.1-1.3zM17 6.3A6.5 6.5 0 0 1 17 17.7l-1.1-1.3a4.7 4.7 0 0 0 0-9.8L17 6.3z" />
                  )}
                </svg>
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => changeVolume(parseFloat(e.target.value))}
                aria-label={t('player.volume')}
                className="hidden h-1 w-20 cursor-pointer accent-buisgroen sm:block"
              />
            </div>
          )}
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
            {status === 'native' && <span className="text-sm text-mist-400">{t('player.native')}</span>}
          </div>
        )}

        {audioNote && status === 'playing' && (
          <div className="pointer-events-none absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-antraciet-900/85 px-4 py-2 text-xs font-medium text-mist backdrop-blur-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-amber-300" fill="currentColor" aria-hidden="true">
              <path d="M3.5 9v6h4l5 5V4l-5 5h-4zm13.7-.2 1.4 1.4L16.4 12l2.2 2.2-1.4 1.4L15 13.4l-2.2 2.2-1.4-1.4L13.6 12l-2.2-2.2 1.4-1.4L15 10.6l2.2-1.8z" />
            </svg>
            {audioNote}
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
                  <h3 className="text-lg font-bold text-mist">{t('player.demoTitle')}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-mist-400">{t('player.demoBody')}</p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-mist">{t('player.errorTitle')}</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-mist-400">{message}</p>
                  {detail && (
                    <div className="mt-3 text-left">
                      <button
                        onClick={() => setShowDetail((s) => !s)}
                        aria-expanded={showDetail}
                        className="text-xs font-semibold text-mist-300 underline decoration-dotted underline-offset-2 outline-none hover:text-buisgroen focus-visible:text-buisgroen"
                      >
                        {showDetail ? t('player.hideDetails') : t('player.showDetails')}
                      </button>
                      {showDetail && (
                        <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-white/10 bg-antraciet-900/70 p-3 text-left text-[11px] leading-relaxed text-mist-300 whitespace-pre-wrap break-words">
                          {detail}
                        </pre>
                      )}
                    </div>
                  )}
                </>
              )}
              <div className="mt-5 flex items-center justify-center gap-2.5">
                {status === 'error' && (
                  <button
                    onClick={() => setHelpOpen(true)}
                    className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-mist outline-none transition-colors hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-buisgroen"
                  >
                    {t('player.help')}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="rounded-full bg-buisgroen px-6 py-2.5 text-sm font-bold text-antraciet-900 outline-none focus-visible:ring-2 focus-visible:ring-buisgroen"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

/**
 * Generieke basis-melding bij een netwerklaag-fout. Bewust niet te specifiek (de
 * exacte oorzaak weten we vaak niet); details staan achter "Toon technische details"
 * en verdere hulp achter "Hulp & tips". Bij een sterk vermoeden van een geo-blokkade
 * plakt fail() de specifiekere geo-hint eronder.
 */
const networkBase =
  'De stream kan niet worden bereikt. Dit ligt meestal aan je netwerk, je provider of een regioblokkade — niet aan de app zelf.'

/** Categorie van een HTTP-status voor de geo-/netwerkdiagnose. */
function httpCategory(status: number): FailCategory {
  if (status === 401 || status === 403) return 'http-auth'
  if (status === 404) return 'http-notfound'
  if (status === 509 || status === 512) return 'http-limit'
  return 'unknown'
}

/** Container (MKV/AVI/…) die browsers sowieso niet afspelen — géén CORS/codec-detail. */
function containerHint(container: string): string {
  return (
    `Dit bestandsformaat (${container}) kan een browser niet afspelen — dat ligt aan de ` +
    `container, niet aan CORS. Deze film speelt wél op de box (Android TV / Fire Stick / Tizen), ` +
    `waar de native speler ${container} ondersteunt.`
  )
}

/** Codec/decodeerfout — géén CORS. De browser kan het formaat niet decoderen. */
function codecHint(what: string): string {
  return (
    `Deze ${what} gebruikt een codec of audioformaat dat de browser niet kan decoderen ` +
    `(bijv. HEVC/H.265-video of AC-3/MP2-audio). Dit is géén CORS-probleem. ` +
    `Speel af op de box (Android TV / Fire Stick / Tizen) — daar decodeert de hardware dit wél.`
  )
}

/** Server gaf een foutstatus terug (login/limiet/offline) — géén CORS. */
function httpHint(status: number): string {
  const reason =
    status === 401 || status === 403
      ? 'inloggegevens geweigerd'
      : status === 404
        ? 'zender niet gevonden'
        : status === 512 || status === 509
          ? 'account of max. verbindingen bereikt'
          : 'server weigerde de stream'
  return (
    `De server antwoordde met HTTP ${status} (${reason}). Dit is géén CORS-probleem. ` +
    `Controleer je account, of het kanaal nog bestaat, en of je niet te veel gelijktijdige verbindingen gebruikt.`
  )
}

/**
 * Vertaalt een mpegts.js-fout naar een eerlijke melding + categorie: MEDIA_ERROR = codec,
 * NETWORK_ERROR met provider-status ≥400 (niet onze proxy-502/504) = serverfout, anders
 * netwerklaag (kenmerkend voor een geo-/netwerkblokkade).
 */
function mpegtsError(
  mpegts: { ErrorTypes: { NETWORK_ERROR: string; MEDIA_ERROR: string } },
  errorType: string,
  _errorDetail: string,
  info?: { code?: number },
): { msg: string; category: FailCategory } {
  if (errorType === mpegts.ErrorTypes.MEDIA_ERROR) {
    return { msg: codecHint('live-zender'), category: 'codec' }
  }
  if (errorType === mpegts.ErrorTypes.NETWORK_ERROR) {
    const code = info?.code
    if (typeof code === 'number' && code >= 400 && code !== 502 && code !== 504) {
      return { msg: httpHint(code), category: httpCategory(code) }
    }
    return { msg: networkBase, category: 'network' }
  }
  return { msg: 'MPEG-TS-stream kon niet afgespeeld worden.', category: 'unknown' }
}
