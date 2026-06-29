import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor-schil voor Android TV / Google TV / Fire OS.
 *
 * Capacitor serveert de web-assets via een lokale WebView-server (https://localhost),
 * dus de gewone build met base '/' is juist (géén VITE_BASE=./ zoals bij Tizen/webOS).
 *
 * Build-flow:
 *   npm run build && npx cap sync android
 *   npx cap open android        # verder bouwen/uitrollen met Android Studio + SDK
 */
const config: CapacitorConfig = {
  appId: 'app.buisz.iptv',
  appName: 'Buisz',
  webDir: 'dist',
  android: {
    // Donkere achtergrond tijdens laden, passend bij het Buisz-thema.
    backgroundColor: '#0c1012',
  },
}

export default config
