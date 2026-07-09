# Backlog & PBI's

Levend overzicht van openstaande punten voor Buisz. Geen strak proces — een plek
om ideeën, schulden en grotere brokken vast te leggen zodat ze niet verdwijnen in
de chat. Volgorde ≈ prioriteit, maar niet in beton.

Status: 🔵 idee · 🟡 klaar om op te pakken · 🟢 in uitvoering · ✅ afgerond

---

## PBI-001 — Cloud Sync van profielinstellingen 🟡

**Waarom.** Nu leven alle voorkeuren (`buisz.*` in localStorage) per apparaat. Wie
op zijn TV, telefoon én tablet kijkt, moet overal opnieuw instellen. We willen een
**opt-in** synchronisatie onder een profiel, zodat voorkeuren en (later) kijk-
geschiedenis meereizen.

**Scope (wat wél synct).** Het `buisz.*`-blok: bron-config, favorieten, voortgang,
taal, buffer-voorkeur, standaard Live TV-weergave, TMDB-sleutel. De EPG-cache
(`buisz.epgCache`) synct **niet** — die is puur lokaal en vluchtig.

**Kritieke eis — E2E-encryptie.** `buisz.source` bevat bij Xtream de
**inloggegevens** (gebruikersnaam/wachtwoord). Die mogen de server nooit leesbaar
bereiken. Versleutel het blob client-side (bijv. WebCrypto AES-GCM met een sleutel
afgeleid van een profiel-wachtwoord/pass-phrase); de backend slaat alleen
onleesbare bytes op. Zonder dit: **niet bouwen.**

**Backend.** Cloudflare Worker + KV (of D1), passend bij de bestaande Worker-proxy
die de gebruiker zelf host. Endpoints: `PUT /sync/:profile` (versleuteld blob +
versie/timestamp), `GET /sync/:profile`. Auth via een profiel-token.

**Conflicten.** Laatste-schrijver-wint met versienummer is voldoende voor v1
(één gebruiker, meerdere apparaten). Toon bij verschil een korte "op dit apparaat
nieuwer/ouder"-melding i.p.v. stil overschrijven.

**Acceptatiecriteria.**
- [ ] Opt-in: standaard uit; gebruiker zet sync expliciet aan met een pass-phrase.
- [ ] Blob wordt client-side versleuteld; server ziet nooit plaintext-credentials.
- [ ] Aan-/uitzetten op elk platform (web, TV, telefoon, tablet).
- [ ] Push bij wijziging (gedebounced) + pull bij opstarten; conflictmelding i.p.v.
      stil overschrijven.
- [ ] Werkt tegen de zelf-gehoste Worker; geen Buisz-centrale server nodig.

**Afhankelijk van.** De gedeelde voorkeur-modules (o.a. `src/api/liveView.ts`) — al
grotendeels aanwezig; ideaal om eerst álle `buisz.*`-toegang achter kleine
get/set-modules te zetten zodat sync één plek raakt.

---

## Techniek / kwaliteit

### PBI-002 — Virtualisatie van het Live TV-grid 🔵
De Gids-overlay is al gevirtualiseerd (`useVirtualRows`). Het zender-**grid** in
`LiveBrowser` is begrensd door mapkeuze en laadt per tegel lui, maar een enorme
"Alle zenders"-map kan alsnog zwaar worden. Virtualiseren vergt afstemming met de
spatial-nav (row/col-indexen voor de D-pad). Oppakken zodra een grote map merkbaar
traag wordt.

### PBI-003 — EPG-bron consolideren achter één abstractie 🔵
Nu zitten XMLTV (nu/straks), `get_short_epg` (per stream) en de retry-logica
verspreid over `epg.ts`, `xtream.ts`, `useLazyChannelEpg.ts`. Eén `epgProvider`-
abstractie (bron kiezen, cachen, ontdubbelen, retry) maakt het testbaar en
makkelijker uit te breiden (bijv. losse XMLTV-URL voor Xtream).

### PBI-004 — Tests voor pure functies 🟡
Nog geen tests. Laaghangend fruit met hoge waarde: playlist-/Xtream-parsers,
`quality`-detectie, bron-detectie (Xtream vs M3U), de host-limiter en de nieuwe
`dedupeEpg`. Vitest toevoegen.

### PBI-005 — App.tsx opsplitsen in hooks 🔵
`App.tsx` is groot. Overlay-state en afspeel-state naar `useOverlays` /
`usePlayback` halen voor leesbaarheid en herbruikbaarheid.

### PBI-006 — Proxy hardenen (SSRF) 🟡
De streaming-proxy is een open relay: hij haalt elke opgegeven URL op. Bij publiek
hosten moet dit beperkt tot de provider-host(s) van de actieve bron, anders is het
een open doorgeefluik. Belangrijk vóór bredere uitrol.

---

## UX / platform

### PBI-007 — TV-remote finish 🔵
D-pad-navigatie tussen de maprail en het grid/gids soepel maken; focus-terugkeer
na afspelen; overal zichtbare focusring. Testen op een echte TV-afstandsbediening.

### PBI-008 — Playability-indicator i18n 🔵
De codec/hardware-afspeelbaarheidsindicator vertalen (NL/EN) net als de rest.

### PBI-009 — libVLC als native engine 🔵
Overwegen als afspeel-engine op Capacitor-platforms voor bredere codec-dekking
(MKV, AC-3, HEVC), ná de eerste hardware-test die uitwijst waar ExoPlayer/AVPlayer
tekortschieten.

---

## Product / distributie (buiten code)

- **Store-tagline zonder "IPTV".** Positioneren als *speler* voor je eigen legale
  bronnen, niet als contentbron. (Actie: gebruiker.)
- **Cloudflare Worker deployen.** De gebruiker host de proxy/Worker zelf onder het
  eigen account (zie `worker/README`). (Actie: gebruiker.)
- **Hardware-test.** Oud→nieuw TV, iOS/Android, native TV-platforms. Bevindingen
  voeden bovenstaande PBI's. (Actie: gebruiker — loopt.)

---

## Recent afgerond ✅
- Gids-overlay gevirtualiseerd (licht bij duizenden kanalen).
- "Bron beheren": Instellingen → bron opent voorgevuld.
- Bijna-dubbele EPG-programma's ontdubbeld (grid stapelt niet meer).
- Standaard Live TV-weergave: gedeelde voorkeur (inline toggle + Instellingen).
