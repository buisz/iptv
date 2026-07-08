/**
 * Verbindings-diagnose: onderscheidt een geo-/netwerkblokkade van andere faaloorzaken.
 *
 * Kernasymmetrie: als de **catalogus laadt** (Xtream `player_api.php` werkt, dus account
 * + API-host bereikbaar) maar **elke stream faalt op netwerkniveau** (time-out/geweigerd,
 * nul videobytes), dan is de streaming-endpoint onbereikbaar vanaf dit netwerk — vrijwel
 * altijd een geo-/ISP-blokkade of een provider-egress-restrictie. (Bevestigd geval: streams
 * werken alleen met VPN.)
 *
 * Eerlijk: dit is een *inferentie*, geen bewijs. Een browser kan zijn publieke IP/ASN of de
 * blokkeerregel niet zien. We stellen alleen vast: "account/API werkt, maar de stream is
 * onbereikbaar vanaf dit netwerk, voor elke geprobeerde zender."
 */

export type FailCategory =
  | 'network' // TCP/TLS/timeout — nul bytes; kenmerkend voor geo/ISP-blokkade
  | 'http-auth' // 401/403 — account/rechten
  | 'http-limit' // 509/512 — max. verbindingen
  | 'http-notfound' // 404 — deze zender bestaat niet (geïsoleerd)
  | 'codec' // decodefout ná succesvolle fetch (HEVC/AC-3…)
  | 'container' // MKV/AVI e.d. — browser speelt de container niet
  | 'unknown'

let catalogLoaded = false
const failures = new Map<string, FailCategory>() // per stream-id de laatste categorie

/** Aanroepen zodra een catalogus succesvol is geladen (auth/API bewezen). */
export function markCatalogLoaded(): void {
  catalogLoaded = true
}

/** Reset bij bronwissel (nieuw account/lijst → schone lei). */
export function resetHealth(): void {
  catalogLoaded = false
  failures.clear()
}

/** Registreer een stream-fout (met de door de speler bepaalde categorie). */
export function recordStreamFailure(streamId: string | undefined, category: FailCategory): void {
  failures.set(streamId || `anon-${failures.size}`, category)
}

/** Registreer dat een stream wél speelde (dan is er geen algemene blokkade). */
export function recordStreamSuccess(streamId: string | undefined): void {
  if (streamId) failures.delete(streamId)
}

/**
 * Vermoeden van een geo-/netwerkblokkade: catalogus geladen én ≥2 verschillende zenders
 * faalden op netwerkniveau. Twee onafhankelijke zenders sluit een enkele dode stream uit.
 */
export function geoBlockSuspected(): boolean {
  if (!catalogLoaded) return false
  let net = 0
  for (const c of failures.values()) if (c === 'network') net++
  return net >= 2
}

/** Mensvriendelijke uitleg + advies (NL) wanneer een blokkade wordt vermoed. */
export function geoBlockHint(): string {
  return (
    'Je account werkt (de catalogus laadde), maar de streams zijn onbereikbaar vanaf dit ' +
    'netwerk — voor elke geprobeerde zender. Dat wijst op een geo-/netwerkblokkade van je ' +
    'provider of ISP. Een VPN (op het apparaat dat de stream ophaalt) lost dit meestal op.'
  )
}
