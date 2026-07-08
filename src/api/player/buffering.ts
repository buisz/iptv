/**
 * Buffer-/latentie-profielen voor de web-spelers (mpegts.js live, hls.js live+VOD).
 *
 * Waarom: over een trage/jitterige verbinding (bijv. VPN) hapert live-video. De grootste
 * boosdoener is dat de speler standaard de "live edge" najaagt (mpegts.js
 * `liveBufferLatencyChasing`, hls.js `lowLatencyMode`), wat op een schokkerige lijn
 * telkens een harde seek + herbuffer veroorzaakt. Deze profielen ruilen wat latentie in
 * voor een grotere buffer die jitter opvangt.
 *
 * Belangrijk (eerlijk): een grotere buffer verhelpt *jitter* (ongelijkmatige aanlevering),
 * niet een structureel te lage bandbreedte. Bij te weinig bandbreedte blijft haperen.
 *
 * Config-waarden zijn geverifieerd tegen de geïnstalleerde versies (mpegts.js 1.8.0,
 * hls.js 1.6.16).
 */

export type BufferPreset = 'auto' | 'low' | 'smooth'
export type BufferProfile = 'LOW' | 'BALANCED' | 'SMOOTH'

const KEY = 'buisz.buffer'

/** Gekozen voorkeur (persistent). Standaard 'auto'. */
export function getBufferPreset(): BufferPreset {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'low' || v === 'smooth' || v === 'auto') return v
  } catch {
    /* geen localStorage */
  }
  return 'auto'
}

export function setBufferPreset(p: BufferPreset): void {
  try {
    localStorage.setItem(KEY, p)
  } catch {
    /* negeren */
  }
}

/**
 * Startprofiel bij een voorkeur. 'auto' begint op BALANCED en mag tijdens de sessie
 * naar SMOOTH klimmen (zie AdaptiveBuffer); dat wordt bewust niet bewaard, zodat een
 * paar slechte minuten niet elke toekomstige sessie extra vertraging geven.
 */
export function startProfile(p: BufferPreset): BufferProfile {
  return p === 'low' ? 'LOW' : p === 'smooth' ? 'SMOOTH' : 'BALANCED'
}

// ── mpegts.js (live TS) ───────────────────────────────────────────────────────
// Gemeenschappelijk: geheugen begrenzen bij lange live-sessies.
const MPEGTS_COMMON = {
  enableWorker: true,
  autoCleanupSourceBuffer: true,
  autoCleanupMaxBackwardDuration: 30,
  autoCleanupMinBackwardDuration: 20,
}

export function mpegtsConfig(profile: BufferProfile): Record<string, unknown> {
  if (profile === 'LOW') {
    // Lage latentie via naadloze playbackRate (liveSync), níet via harde seeks.
    return {
      ...MPEGTS_COMMON,
      enableStashBuffer: false,
      stashInitialSize: 128 * 1024,
      liveBufferLatencyChasing: false,
      liveSync: true,
      liveSyncMaxLatency: 2.0,
      liveSyncTargetLatency: 1.0,
      liveSyncPlaybackRate: 1.1,
    }
  }
  if (profile === 'SMOOTH') {
    // Grote jitter-buffer, geen edge-chasing, één verbinding warm houden.
    return {
      ...MPEGTS_COMMON,
      enableStashBuffer: true,
      stashInitialSize: 1024 * 1024,
      liveBufferLatencyChasing: false,
      liveSync: false,
      lazyLoad: false,
    }
  }
  // BALANCED (standaard): modest cushion, geen harde seeks.
  return {
    ...MPEGTS_COMMON,
    enableStashBuffer: true,
    stashInitialSize: 384 * 1024,
    liveBufferLatencyChasing: false,
    liveSync: false,
  }
}

// ── hls.js (live + VOD) ───────────────────────────────────────────────────────
// Constraint (mergeConfig gooit anders): liveMaxLatencyDurationCount > liveSyncDurationCount,
// en count-based en duration-based sleutels niet mengen.
export function hlsConfig(profile: BufferProfile): Record<string, unknown> {
  if (profile === 'LOW') {
    return {
      lowLatencyMode: true,
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 10,
      maxLiveSyncPlaybackRate: 1.5,
      maxBufferLength: 10,
      backBufferLength: 15,
      maxBufferHole: 0.5,
    }
  }
  if (profile === 'SMOOTH') {
    return {
      lowLatencyMode: false,
      liveSyncDurationCount: 6,
      liveMaxLatencyDurationCount: 20,
      maxLiveSyncPlaybackRate: 1,
      maxBufferLength: 60,
      maxMaxBufferLength: 120,
      maxBufferSize: 120 * 1000 * 1000,
      maxBufferHole: 0.5,
      backBufferLength: 60,
      startLevel: 0,
      capLevelToPlayerSize: true,
      abrBandWidthFactor: 0.8,
      abrBandWidthUpFactor: 0.5,
      // Geef de proxy round-trip-ruimte: een trage-maar-goede fetch niet afkappen.
      fragLoadPolicy: {
        default: {
          maxTimeToFirstByteMs: 20000,
          maxLoadTimeMs: 120000,
          timeoutRetry: { maxNumRetry: 4, retryDelayMs: 0, maxRetryDelayMs: 0 },
          errorRetry: { maxNumRetry: 8, retryDelayMs: 1000, maxRetryDelayMs: 8000, backoff: 'linear' },
        },
      },
    }
  }
  // BALANCED (standaard)
  return {
    lowLatencyMode: false,
    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 8,
    maxBufferLength: 30,
    maxMaxBufferLength: 120,
    backBufferLength: 30,
    maxBufferHole: 0.5,
  }
}

/**
 * Detecteert herhaald haperen (rebuffering) en laat de aanroeper één keer per sessie
 * "opschalen" naar een grotere buffer. Alleen zinvol voor de 'auto'-voorkeur.
 *
 * Signaal: `waiting`-events op het <video>-element (decoder wacht op data). We negeren
 * `waiting` vlak na een `seeking` (dat is een legitieme seek, geen netwerk-hapering).
 * Na `threshold` haperingen binnen `windowMs` → één keer `onEscalate()`.
 */
export interface AdaptiveOptions {
  threshold?: number
  windowMs?: number
  onEscalate: () => void
}

export class AdaptiveBuffer {
  private video: HTMLVideoElement
  private threshold: number
  private windowMs: number
  private onEscalate: () => void
  private stalls: number[] = []
  private seeking = false
  private fired = false

  constructor(video: HTMLVideoElement, opts: AdaptiveOptions) {
    this.video = video
    this.threshold = opts.threshold ?? 3
    this.windowMs = opts.windowMs ?? 60000
    this.onEscalate = opts.onEscalate
    video.addEventListener('waiting', this.onWaiting)
    video.addEventListener('seeking', this.onSeeking)
    video.addEventListener('seeked', this.onSeeked)
  }

  private now(): number {
    // performance.now bestaat overal; vermijdt Date.now-verbod in sommige contexten.
    return typeof performance !== 'undefined' ? performance.now() : 0
  }

  private onSeeking = () => {
    this.seeking = true
  }
  private onSeeked = () => {
    this.seeking = false
  }

  private onWaiting = () => {
    if (this.fired || this.seeking) return
    const t = this.now()
    this.stalls.push(t)
    this.stalls = this.stalls.filter((s) => t - s <= this.windowMs)
    if (this.stalls.length >= this.threshold) {
      this.fired = true
      this.onEscalate()
    }
  }

  destroy(): void {
    this.video.removeEventListener('waiting', this.onWaiting)
    this.video.removeEventListener('seeking', this.onSeeking)
    this.video.removeEventListener('seeked', this.onSeeked)
  }
}
