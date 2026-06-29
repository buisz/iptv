/**
 * Native afspeel-engine (fase: afspeel-abstractie).
 *
 * In de Capacitor-app (Android/iOS) spelen we live/HLS/VOD af met de NATIVE speler
 * (ExoPlayer op Android, AVPlayer op iOS) via @capgo/capacitor-video-player.
 * Voordeel t.o.v. de browser-engines (mpegts.js/hls.js): geen CORS, hardware-
 * decoding, en betere codec-ondersteuning. In de browser wordt dit niet gebruikt
 * (zie Player.tsx — daar blijft de web-engine actief).
 */
import { Capacitor } from '@capacitor/core'

const PLAYER_ID = 'buisz'

/** Draaien we in een native Capacitor-app (dan native speler gebruiken)? */
export function nativeVideoAvailable(): boolean {
  return Capacitor.isNativePlatform?.() ?? false
}

async function plugin() {
  const mod = await import('@capgo/capacitor-video-player')
  return mod.VideoPlayer
}

export interface NativePlayInput {
  url: string
  title?: string
  /** Hervatpositie in seconden (best-effort). */
  startAt?: number
}

/** Opent de native full-screen speler. Geeft true bij succes. */
export async function nativePlay({ url, title, startAt }: NativePlayInput): Promise<boolean> {
  try {
    const p = await plugin()
    await p.initPlayer({
      mode: 'fullscreen',
      url,
      playerId: PLAYER_ID,
      componentTag: 'app',
      title: title ?? '',
      smallTitle: '',
      exitOnEnd: true,
    })
    if (startAt && startAt > 5) {
      // Even wachten tot de speler klaar is met laden, dan hervatten.
      setTimeout(() => {
        p.setCurrentTime({ playerId: PLAYER_ID, seektime: startAt }).catch(() => {})
      }, 1200)
    }
    return true
  } catch {
    return false
  }
}

/** Leest de huidige positie + duur (voor "Verder kijken"); null bij fout. */
export async function nativeProgress(): Promise<{ position: number; duration: number } | null> {
  try {
    const p = await plugin()
    const [cur, dur] = await Promise.all([
      p.getCurrentTime({ playerId: PLAYER_ID }),
      p.getDuration({ playerId: PLAYER_ID }),
    ])
    const position = Number((cur as { value?: number })?.value) || 0
    const duration = Number((dur as { value?: number })?.value) || 0
    return duration > 0 ? { position, duration } : null
  } catch {
    return null
  }
}

/** Luistert op het sluiten/eindigen van de native speler. */
export async function onNativeExit(cb: () => void): Promise<() => void> {
  try {
    // addListener bestaat op elke Capacitor-plugin runtime, maar staat niet in de
    // TS-definities van deze plugin → losjes typeren.
    const p = (await plugin()) as unknown as {
      addListener: (e: string, fn: () => void) => Promise<{ remove: () => void }>
    }
    const h1 = await p.addListener('jeepCapVideoPlayerExit', () => cb())
    const h2 = await p.addListener('jeepCapVideoPlayerEnded', () => cb())
    return () => {
      void h1.remove()
      void h2.remove()
    }
  } catch {
    return () => {}
  }
}

/** Stopt alle native spelers. */
export async function nativeStop(): Promise<void> {
  try {
    const p = await plugin()
    await p.stopAllPlayers()
  } catch {
    /* niets */
  }
}
