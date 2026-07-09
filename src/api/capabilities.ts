/**
 * Device-capaciteit × stream-codec → afspeelbaarheid.
 *
 * We detecteren wat het apparaat (browser/WebView/TV) hardware-matig kan decoden
 * en combineren dat met de codec/resolutie-hint van een stream tot een eerlijke
 * inschatting: speelt dit wel / misschien-niet / niet af op deze hardware?
 *
 * Eerlijkheid:
 * - De detectie via `MediaCapabilities.decodingInfo()` is accuraat in een browser
 *   en in de Android-WebView. Op smart-TV's (Tizen/webOS) speelt het echte afspelen
 *   via de native player (AVPlay/media-pipeline), die méér kan dan de WebView meldt —
 *   daar is dit dus een conservatieve ondergrens, geen absolute waarheid.
 * - De codec van een stream kennen we zelden hard: voor Xtream-VOD soms uit metadata,
 *   voor live/M3U hooguit als naam-hint. Daarom geven we nooit een vals "kan niet" af
 *   als we de codec niet weten — dan is het simpelweg "onbekend".
 */
import { useEffect, useState } from 'react'
import type { QualityHint } from '../types/content'

/** Per codec: kan het apparaat het decoden, en gebeurt dat energiezuinig (≈ hardware)? */
export interface CodecCap {
  supported: boolean
  /** `powerEfficient` uit MediaCapabilities — software-decoding is supported maar niet
   * efficiënt en kan op zwakke apparaten haperen. */
  efficient: boolean
}

export interface DeviceProfile {
  /** H.264/AVC — vrijwel elk apparaat ondersteunt dit in hardware. */
  h264: CodecCap
  /** HEVC/H.265 op 1080p. */
  hevc: CodecCap
  /** HEVC/H.265 op 4K (2160p). */
  hevc4k: CodecCap
  /** AV1. */
  av1: CodecCap
  /** Of de detectie überhaupt kon draaien (anders: alles onbekend → niet waarschuwen). */
  detected: boolean
}

/** Representatieve codec-strings per codec/resolutie voor MediaCapabilities. */
const PROBES = {
  h264: { contentType: 'video/mp4; codecs="avc1.42E01E"', width: 1280, height: 720 },
  hevc: { contentType: 'video/mp4; codecs="hvc1.1.6.L93.B0"', width: 1920, height: 1080 },
  hevc4k: { contentType: 'video/mp4; codecs="hvc1.2.4.L153.B0"', width: 3840, height: 2160 },
  av1: { contentType: 'video/mp4; codecs="av01.0.05M.08"', width: 1920, height: 1080 },
} as const

async function probe(p: { contentType: string; width: number; height: number }): Promise<CodecCap> {
  const mc = (navigator as Navigator & { mediaCapabilities?: MediaCapabilities }).mediaCapabilities
  if (mc?.decodingInfo) {
    try {
      const info = await mc.decodingInfo({
        type: 'media-source',
        video: {
          contentType: p.contentType,
          width: p.width,
          height: p.height,
          bitrate: 4_000_000,
          framerate: 30,
        },
      })
      // `powerEfficient` onderscheidt hardware- van software-decoding: supported maar
      // niet efficiënt = CPU-decode dat op zwakke apparaten kan haperen.
      return { supported: info.supported, efficient: info.supported && info.powerEfficient }
    } catch {
      /* val terug op isTypeSupported */
    }
  }
  // Fallback: MediaSource.isTypeSupported (grover; geen efficiëntie-signaal → aanname zuinig).
  const MS = (window as unknown as { MediaSource?: { isTypeSupported(t: string): boolean } }).MediaSource
  if (MS?.isTypeSupported) {
    try {
      const ok = MS.isTypeSupported(p.contentType)
      return { supported: ok, efficient: ok }
    } catch {
      /* niets */
    }
  }
  return { supported: false, efficient: false }
}

let cached: DeviceProfile | null = null
let inflight: Promise<DeviceProfile> | null = null
const listeners = new Set<(p: DeviceProfile) => void>()

const NOCAP: CodecCap = { supported: false, efficient: false }
const UNKNOWN: DeviceProfile = { h264: NOCAP, hevc: NOCAP, hevc4k: NOCAP, av1: NOCAP, detected: false }

async function runDetection(): Promise<DeviceProfile> {
  const hasMC = !!(navigator as Navigator & { mediaCapabilities?: unknown }).mediaCapabilities
  const hasMS = !!(window as unknown as { MediaSource?: unknown }).MediaSource
  if (!hasMC && !hasMS) {
    cached = { ...UNKNOWN }
    return cached
  }
  const [h264, hevc, hevc4k, av1] = await Promise.all([
    probe(PROBES.h264),
    probe(PROBES.hevc),
    probe(PROBES.hevc4k),
    probe(PROBES.av1),
  ])
  cached = { h264, hevc, hevc4k, av1, detected: true }
  for (const fn of listeners) fn(cached)
  return cached
}

/** Detecteer (gecachet) de codec-capaciteit van dit apparaat. */
export function getDeviceProfile(): Promise<DeviceProfile> {
  if (cached) return Promise.resolve(cached)
  if (!inflight) inflight = runDetection()
  return inflight
}

/** Synchrone momentopname (UNKNOWN tot detectie klaar is). */
export function deviceProfileSnapshot(): DeviceProfile {
  return cached ?? UNKNOWN
}

/** React-hook: device-profiel, herrendert zodra detectie klaar is. */
export function useDeviceProfile(): DeviceProfile {
  const [profile, setProfile] = useState<DeviceProfile>(() => cached ?? UNKNOWN)
  useEffect(() => {
    let active = true
    if (cached) {
      setProfile(cached)
    } else {
      getDeviceProfile().then((p) => {
        if (active) setProfile(p)
      })
    }
    const fn = (p: DeviceProfile) => {
      if (active) setProfile(p)
    }
    listeners.add(fn)
    return () => {
      active = false
      listeners.delete(fn)
    }
  }, [])
  return profile
}

export type Playability = 'ok' | 'maybe' | 'no' | 'unknown'

/**
 * Bepaal of een stream waarschijnlijk speelt op dit apparaat.
 *
 * Conservatief: bij twijfel of ontbrekende info geven we liever `unknown` of `maybe`
 * dan een vals `no`. Een rood "kan niet" verschijnt alleen als we de codec écht kennen
 * én het apparaat die codec aantoonbaar niet ondersteunt.
 */
export function playability(quality: QualityHint | undefined, profile: DeviceProfile): Playability {
  if (!quality || !profile.detected) return 'unknown'

  const wants4k = quality.res === '4k'
  const codec = quality.codec

  // Supported + energiezuinig (hardware) → ok; supported maar niet efficiënt
  // (software-decode) → maybe (kan haperen op zwakke apparaten).
  const grade = (c: CodecCap): Playability => (c.supported ? (c.efficient ? 'ok' : 'maybe') : 'no')

  // Zonder bekende codec kunnen we hooguit op resolutie iets zeggen, en dat is zwak:
  // een 4K-stream is meestal HEVC/AV1, dus als 4K-HEVC ontbreekt → "misschien niet".
  if (!codec) {
    if (wants4k && !profile.hevc4k.supported && !profile.av1.supported) return 'maybe'
    return 'unknown'
  }

  if (codec === 'h264') {
    // Vrijwel universeel; alleen 4K-H.264 kan een zwakke 1080p-decoder te veel zijn.
    if (wants4k && !profile.h264.efficient) return 'maybe'
    return profile.h264.supported ? grade(profile.h264) : 'maybe'
  }

  if (codec === 'hevc') {
    if (wants4k) {
      if (profile.hevc4k.supported) return grade(profile.hevc4k)
      if (profile.hevc.supported) return 'maybe' // 1080p-HEVC kan, 4K mogelijk niet
      return 'no'
    }
    return grade(profile.hevc)
  }

  if (codec === 'av1') {
    if (profile.av1.supported) return wants4k ? 'maybe' : grade(profile.av1)
    return 'no'
  }

  return 'unknown'
}

/** Korte, mensvriendelijke uitleg bij een afspeelbaarheid (NL). */
export function playabilityReason(p: Playability, quality?: QualityHint): string {
  const codec = quality?.codec ? quality.codec.toUpperCase() : null
  const res = quality?.res ? quality.res.toUpperCase() : null
  const label = [res, codec].filter(Boolean).join(' ')
  switch (p) {
    case 'no':
      return label
        ? `Dit apparaat kan ${label} waarschijnlijk niet afspelen.`
        : 'Dit apparaat kan deze codec waarschijnlijk niet afspelen.'
    case 'maybe':
      return label
        ? `${label} decodet mogelijk via software en kan haperen op dit apparaat.`
        : 'Deze stream kan haperen op dit apparaat.'
    case 'ok':
      return label ? `${label} speelt af op dit apparaat.` : 'Speelt af op dit apparaat.'
    default:
      return 'Afspeelbaarheid onbekend (codec niet zeker).'
  }
}
