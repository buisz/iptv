/**
 * Voorkeur voor de standaard Live TV-weergave (gids of grid).
 *
 * Gedeeld door de inline toggle in LiveBrowser én de instelling in Settings, zodat
 * ze niet uit elkaar lopen. Lokaal opgeslagen (localStorage); lift straks mee met
 * de profiel-Cloud-Sync (zelfde `buisz.*`-blok).
 */
export type LiveView = 'guide' | 'grid'

const KEY = 'buisz.liveView'

export function getLiveView(): LiveView {
  try {
    return localStorage.getItem(KEY) === 'grid' ? 'grid' : 'guide'
  } catch {
    return 'guide'
  }
}

export function setLiveView(v: LiveView): void {
  try {
    localStorage.setItem(KEY, v)
  } catch {
    /* negeren — geen opslag beschikbaar */
  }
  // Zelfde-document notificatie (het `storage`-event vuurt alleen cross-tab).
  try {
    window.dispatchEvent(new CustomEvent('buisz:liveView', { detail: v }))
  } catch {
    /* oude runtimes zonder CustomEvent — niet kritiek */
  }
}
