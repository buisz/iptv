/**
 * Auto-detectie van een bron uit één geplakte link (fase: onboarding).
 *
 * Veel providers geven óf een Xtream-link (`player_api.php`), óf een Xtream-M3U-
 * export (`get.php?...&type=m3u_plus`) waar we de inloggegevens uit kunnen halen,
 * óf een kale M3U/M3U8-URL. We raden het type en geven een ingevulde Source terug
 * plus een korte uitleg.
 */
import type { Source } from '../types/source'

export interface Detection {
  source: Source
  /** Korte uitleg voor de gebruiker over wat er gedetecteerd is. */
  note: string
  /** Of er nog velden ingevuld/bevestigd moeten worden. */
  needsConfirm: boolean
}

export function detectSource(input: string): Detection | null {
  const text = input.trim()
  if (!text) return null

  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }

  const host = url.hostname
  const secure = url.protocol === 'https:'
  const port = url.port ? Number(url.port) : undefined
  const params = url.searchParams
  const username = params.get('username') ?? undefined
  const password = params.get('password') ?? undefined
  const path = url.pathname.toLowerCase()

  // 1) Expliciete Xtream-API-link.
  if (path.includes('player_api.php') && username && password) {
    return {
      source: { kind: 'xtream', host, port, secure, username, password },
      note: 'Xtream-account herkend — we gebruiken de Xtream-API (categorieën + EPG).',
      needsConfirm: true,
    }
  }

  // 2) Xtream-M3U-export (get.php met inloggegevens) → liever de Xtream-API.
  if (path.includes('get.php') && username && password) {
    return {
      source: { kind: 'xtream', host, port, secure, username, password },
      note: 'Xtream-playlist herkend. We gebruiken de Xtream-API (rijkere data dan platte M3U).',
      needsConfirm: true,
    }
  }

  // 3) Kale M3U/M3U8-URL.
  if (/\.m3u8?($|\?)/.test(path) || params.get('type')?.includes('m3u') || path.endsWith('/playlist')) {
    return {
      source: { kind: 'm3u-url', url: text },
      note: 'M3U-playlist herkend.',
      needsConfirm: false,
    }
  }

  // 4) Onbekend, maar wel een geldige URL → behandel als M3U (beste gok).
  return {
    source: { kind: 'm3u-url', url: text },
    note: 'Onbekend formaat — we proberen het als M3U-playlist. Klopt het type niet? Kies handmatig.',
    needsConfirm: true,
  }
}
