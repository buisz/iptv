/**
 * Bron-configuratie (fase 2).
 *
 * De gebruiker laadt zijn eigen legale playlist. Drie soorten bronnen worden
 * ondersteund, plus de ingebouwde demo. Configuratie wordt lokaal bewaard
 * (localStorage) — gevoelige Xtream-gegevens verlaten het apparaat niet.
 */

export type SourceKind = 'demo' | 'm3u-url' | 'm3u-text' | 'xtream'

/** Presets + custom template voor het live-stream-URL-formaat (providers verschillen). */
export type LiveFormatPreset = 'ts' | 'm3u8' | 'mpegts-noext' | 'custom'

export interface DemoSource {
  kind: 'demo'
}

export interface M3uUrlSource {
  kind: 'm3u-url'
  url: string
  /** Optionele XMLTV-EPG-URL (overschrijft `x-tvg-url` uit de playlist). */
  epgUrl?: string
}

export interface M3uTextSource {
  kind: 'm3u-text'
  /** Rauwe inhoud van een geüpload .m3u/.m3u8-bestand. */
  text: string
  /** Bestandsnaam, puur voor weergave. */
  name?: string
}

export interface XtreamSource {
  kind: 'xtream'
  /** Host zonder schema, bijv. "voorbeeld.tv". */
  host: string
  port?: number
  /** http of https. */
  secure?: boolean
  username: string
  password: string
  /**
   * Live-URL-formaat. `ts`/`m3u8` zijn de gangbare; `mpegts-noext` laat de
   * extensie weg; `custom` gebruikt `liveTemplate`.
   */
  liveFormat?: LiveFormatPreset
  /**
   * Custom template met placeholders: {scheme} {host} {port} {username}
   * {password} {id} {ext}. Alleen gebruikt bij liveFormat === 'custom'.
   */
  liveTemplate?: string
}

export type Source =
  | DemoSource
  | M3uUrlSource
  | M3uTextSource
  | XtreamSource

export const DEMO_SOURCE: DemoSource = { kind: 'demo' }

export function describeSource(source: Source): string {
  switch (source.kind) {
    case 'demo':
      return 'Demo-bron'
    case 'm3u-url':
      return `M3U · ${safeHost(source.url)}`
    case 'm3u-text':
      return `M3U-bestand${source.name ? ` · ${source.name}` : ''}`
    case 'xtream':
      return `Xtream · ${source.host}`
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url.slice(0, 40)
  }
}
