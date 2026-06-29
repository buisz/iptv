/**
 * Google Cast — CAF Web Sender (fase: casten).
 *
 * Werkt in een ECHTE Chrome-browser (desktop + Android Chrome). Werkt NIET in een
 * plain Android System WebView (Capacitor): daar levert de WebView geen Cast-stack,
 * dus blijft alles defensief uit. In-app Chromecast op Android vereist een native
 * Cast-plugin (zie docs/platforms.md, "Casten").
 *
 * We gebruiken de Default Media Receiver (CC1AD845) zodat er geen eigen receiver
 * geregistreerd hoeft te worden. Beperking: geen DRM, geen custom request-headers.
 */

// Minimale, losse typering voor de globale Cast-API's (geen extra @types nodig).
declare global {
  interface Window {
    __onGCastApiAvailable?: (available: boolean) => void
    cast?: any
    chrome?: any
  }
}

let initialized = false
let available = false
const listeners = new Set<(a: boolean) => void>()

function notify() {
  for (const l of listeners) l(available)
}

/** Laadt de CAF Sender SDK eenmalig (https/secure-context vereist). */
export function initCast(): void {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return
  // Cast/Presentation API vereist een secure origin (https of localhost).
  if (!window.isSecureContext) return
  initialized = true

  window.__onGCastApiAvailable = (isAvailable: boolean) => {
    if (isAvailable) setup()
  }

  const script = document.createElement('script')
  // loadCastFramework=1 is verplicht voor cast.framework (anders alleen v2-API).
  script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1'
  script.async = true
  document.head.appendChild(script)
}

function setup() {
  const { cast, chrome } = window
  if (!cast?.framework || !chrome?.cast) return

  const ctx = cast.framework.CastContext.getInstance()
  ctx.setOptions({
    receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID, // 'CC1AD845'
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
  })

  const update = () => {
    const state = ctx.getCastState?.()
    available = Boolean(state) && state !== 'NO_DEVICES_AVAILABLE'
    notify()
  }
  ctx.addEventListener(cast.framework.CastContextEventType.CAST_STATE_CHANGED, update)
  update()
}

/** Abonneer op beschikbaarheid van Cast-apparaten; geeft een unsubscribe terug. */
export function onCastAvailability(cb: (a: boolean) => void): () => void {
  listeners.add(cb)
  cb(available)
  return () => {
    listeners.delete(cb)
  }
}

/** Cast-MIME voor een stream-URL. */
export function castContentType(url: string): string {
  if (/\.m3u8(\?|$)/i.test(url)) return 'application/x-mpegURL'
  if (/\.mp4(\?|$)/i.test(url)) return 'video/mp4'
  if (/\.mkv(\?|$)/i.test(url)) return 'video/x-matroska'
  if (/\.mpd(\?|$)/i.test(url)) return 'application/dash+xml'
  // Live/onbekend: HLS is de beste gok voor de Default Media Receiver.
  return 'application/x-mpegURL'
}

/** Start (zo nodig) een sessie en laadt de media. Geeft true bij succes. */
export async function castMedia(url: string, title?: string): Promise<boolean> {
  const { cast, chrome } = window
  if (!cast?.framework || !chrome?.cast) return false

  const ctx = cast.framework.CastContext.getInstance()
  try {
    if (!ctx.getCurrentSession()) await ctx.requestSession()
    const session = ctx.getCurrentSession()
    if (!session) return false

    const mediaInfo = new chrome.cast.media.MediaInfo(url, castContentType(url))
    if (title) {
      mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata()
      mediaInfo.metadata.title = title
    }
    await session.loadMedia(new chrome.cast.media.LoadRequest(mediaInfo))
    return true
  } catch {
    return false
  }
}
