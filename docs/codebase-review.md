# Codebase-review Buisz (multi-dimensioneel)

Gebundelde bevindingen van een read-only scan over 5 dimensies: visuele layout per
platform/device, player & (hardware-)decoding, security, performance/schaal, en
architectuur/correctheid. Gerangschikt op prioriteit, met `bestand:regel` en fix.

Legenda severity → prioriteit: **P0** = correctheid/privacy/security-blocker ·
**P1** = hoge impact (perf/kwaliteit) · **P2** = middel · **P3** = laag/nice-to-have.
Dimensie-tags: [layout] [player] [security] [perf] [arch].

---

## P0 — eerst oppakken (correctheid / privacy / security)

### P0-1 · "Alles wissen" laat bronnen + Xtream-credentials staan [arch]
`SettingsOverlay.tsx` `STORAGE_KEYS` mist de multi-bron-sleutels `buisz.sources`,
`buisz.activeSource`, `buisz.mergeSources`. "Alles resetten" + reload leest de bronnen
(mét credentials) gewoon terug. Regressie uit de multi-bron-feature. **Triviale fix:**
drie sleutels toevoegen. *(Ik heb wel al buisz.history/liveView/epgCache toegevoegd,
maar deze drie over het hoofd gezien.)*

### P0-2 · Samengevoegd laden is alles-of-niets [arch] · `useCatalog.ts:91-103`
Merge gebruikt `Promise.all`; één onbereikbare/verlopen bron laat de hele merge
rejecten → geen catalogus, terwijl de andere bronnen prima waren. **Fix:**
`Promise.allSettled`, geslaagde delen mergen, mislukte als niet-fatale `notice`.

### P0-3 · Proxy is een open relay / SSRF [security] · `server/proxy.mjs`, `vite.config.ts`, `worker/src/index.js`
`?url=` wordt zonder allowlist opgehaald, `redirect: 'follow'` volgt naar interne/
loopback/metadata-hosts, ACAO `*`, dev bindt op `host:true` (LAN). Plus: Xtream-
credentials lekken in `console.warn` (stream-URL bevat user/pass) en in de proxy-
querystring. **Niet publiek hosten** tot dit dicht is. **Fix:** host-allowlist op de
provider-host(s) + private/loopback/link-local blokkeren (ook na redirect) + token op
de proxy + credentials redigeren in logs + user/pass uit de querystring (POST/token).
*(Deels al bekend als backlog PBI-006.)*

---

## P1 — hoge impact (perf / kwaliteit / platform)

### P1-1 · Live-grid én GuideGrid niet gevirtualiseerd [perf][layout] · `LiveBrowser.tsx:171`, `GuideGrid.tsx:80`
Beide renderen álle kanalen: bij 3000+ zenders tienduizenden DOM-nodes + evenzoveel
IntersectionObservers + get_short_epg-calls tegelijk → vastlopen op zwakke TV's. De
Gids-overlay ís al gevirtualiseerd; deze twee (juist de dagelijkse weergaven) niet.
**Grootste hefboom.** **Fix:** `useVirtualRows` toepassen (grid: columns=`cols`;
GuideGrid: columns=1, rowHeight=60). Verlaagt meteen ook de EPG-call-storm (P1-6).

### P1-2 · Native buffer-profielen niet bedraad [player] · `nativeVideo.ts:32-54`
De hele buffer-laag (Vloeiend/Auto/Lage latentie, AdaptiveBuffer) zit alleen in het
web-pad. Op Android TV / Fire / iOS doet de instelling **niets** — precies de
doelplatformen en het VPN-stotter-scenario. **Fix:** preset doorgeven aan de native
laag (ExoPlayer `DefaultLoadControl` / AVPlayer `preferredForwardBufferDuration`), of
in de UI expliciet maken dat de bufferkeuze alleen voor web geldt.

### P1-3 · Oude-TV-CSS breekt de layout [layout] · `index.css`, `PosterCard.tsx:48`, `tokens.css:35`
`@vitejs/plugin-legacy` transpileert alleen JS; niet-gepolyfillde CSS breekt op
Chromium <88 (Tizen/webOS): `aspect-ratio` (posters klappen tot 0px hoogte), flex
`gap` (spacing valt app-breed weg), CSS Grid (grids → 1 kolom) en `clamp()` (geen
`--edge`/`--row-gap`). **Fix:** gerichte CSS-fallbacks (`height`-fallback op kaarten,
`> * + *`-margins voor gap, `@supports`-fallbacks, statische var-fallback vóór clamp),
óf de realistische minimale TV-engine bijstellen en documenteren.

### P1-4 · Merge-dedupe klapt óók verschillende films/series samen [arch] · `merge.ts:21-49`
`dedupe` draait op álle rijen (niet enkel live): twee inhoudelijk verschillende titels
die genormaliseerd gelijk zijn (remake; "The Office" NL vs US) worden één tegel, de
tweede verdwijnt als `altSource` met verkeerde stream. **Fix:** titel-dedupe beperken
tot `kind==='live'`, of voor VOD/series `year`/`ref.id` in de sleutel opnemen.

### P1-5 · Gids/zoeken tonen dubbele kanalen + id-botsingen in merge [arch] · `merge.ts:112-121`, `App.tsx:141`
`allItems` (voedt GuideOverlay + Search + hero) is alleen op `id` ontdubbeld, maar
Xtream-id's zijn bron-lokaal → botsingen tussen bronnen (item stil weg uit zoeken/hero)
én dezelfde zender dubbel in gids/zoeken terwijl de rijen het netjes samenvoegen.
**Fix:** dedupe `allItems` op `sourceId+'::'+id`, en lever een titel-ontdubbelde lijst
voor gids/zoeken.

### P1-6 · Volledige catalogus-clone + geen memoisatie [perf] · `App.tsx:291`, `PosterCard`/`ContentRow`/`LiveTile`
Elke detail-opening/`patchCatalog` herbouwt de hele `sections`-boom → nieuwe identiteit
voor álle items → alles re-rendert. Geen `React.memo`, en `onOpen`/`onFavoriteChange`
zijn inline arrows. `recentRow` bouwt `new Map(allItems)` bij elke `cwVersion`-bump
(favoriet togglen = O(totaal)). **Fix:** gericht item verrijken (overlay-map i.p.v.
boom herschrijven), `React.memo` + `useCallback`, `byId`-map memoiseren op `[allItems]`.

### P1-7 · get_short_epg-storm + EPG-cache te klein [perf] · `useLazyChannelEpg.ts`, `epgCache.ts:16`
Bij niet-matchende XMLTV vuren álle zichtbare tegels een per-kanaal-call; zonder
virtualisatie (P1-1) worden dat er duizenden in de onbegrensde limiter-queue.
`MAX_ENTRIES=800` < een 3000-kanaals map → LRU-thrashing. **Fix:** virtualisatie
(P1-1) lost het gros op; verhoog `MAX_ENTRIES` (~4000) en cap/annuleer de queue bij
ver-uit-beeld scrollen.

---

## P2 — middel

- **P2-1 · GuideGrid niet met D-pad te bedienen [layout]** `GuideGrid.tsx` — de
  standaard Live-weergave mist `data-nav-item/row/col`; op TV alleen via Tab. Ken
  indices toe en koppel horizontaal scrollen aan focus.
- **P2-2 · `powerEfficient` genegeerd [player]** `capabilities.ts:41` — `supported`
  omvat software-decode; groene badge kan in werkelijkheid stotteren. Weeg
  `powerEfficient` mee (supported && !powerEfficient → `maybe`) en pas de tekst aan.
- **P2-3 · hls.js geen recovery + foutclassificatie [player]** `Player.tsx:299` —
  eerste fatale NETWORK/MEDIA-fout niet herstellen (`startLoad`/`recoverMediaError`);
  stall/buffer-fouten worden misleidend als "codec/HEVC" gelabeld.
- **P2-4 · Fout-/badge-teksten hardcoded NL [player]** `Player.tsx`, `capabilities.ts`,
  `health.ts` — `lang='en'` krijgt Nederlandse foutuitleg/tooltips. Naar i18n.
- **P2-5 · XMLTV-parse op main thread + merge niet progressief [perf]** `epg.ts:208`,
  `useCatalog.ts` — tot 2·N full-text regex-passes over ≤12MB per bron → freeze; merge
  toont niets tot alles binnen is. Parse naar Web Worker; merge progressief maken.
- **P2-6 · Focus-ring mobiele navtabs + overlay-bereik via D-pad [layout]**
  `NavBar.tsx:150`, `GuideOverlay.tsx` — `outline-none` zonder `focus-visible:ring`;
  gevirtualiseerde overlays niet via Tab bereikbaar. Ring herstellen + pijltjes-scroll.
- **P2-7 · assemble() draait 3× tijdens progressive load [perf]** `xtream.ts:467` —
  coalesce/debounce de emits of bouw incrementeel.

---

## P3 — laag / nice-to-have

- **P3-1** Merge-voorkeur blijft "aan" bij terugval naar 1 bron [arch] `sources.ts` —
  bij ≤1 bron `setMergeEnabled(false)`.
- **P3-2** Dubbele horizontale scrollbar in GuideGrid (native + HScrollbar) [layout] —
  native horizontaal verbergen.
- **P3-3** Player z-70 < Search/Guide z-75 [layout] — latente inversie; Player ≥85.
- **P3-4** Drie nu/straks-implementaties (`nowNext`, `pickNowNext`, inline in Detail)
  [arch] — consolideren tot één.
- **P3-5** Engine-heuristiek: extensieloze VOD op cijfer-id → mpegts; geen DASH-detectie
  [player] `Player.tsx:53`.
- **P3-6** Dubbele foutafhandeling (`<video>` error + engine error) → dubbele
  `recordStreamFailure` [player] `Player.tsx:395`.
- **P3-7** Foreground-retry roept `onThrottled` per poging (limit 8→1 per 429-serie)
  [perf] `proxy.ts:150`.
- **P3-8** Koppelrelay bewaart credentials plaintext in KV (TTL 300s) [security]
  `worker/src/index.js:188` — E2E (samen met PBI-001).
- **P3-9** Cache zonder `Vary`, sleutel = volledige URL [security] `cache.mjs:41`.

---

## Verifieerd in orde (geen actie)
- Geen XSS-sinks: geen `dangerouslySetInnerHTML`/`innerHTML`/`eval`; alle onbetrouwbare
  velden als React-tekst (auto-escaped); `<img src>` uit playlists voert geen script uit.
- App levert zelf geen content (geen ingebouwde bronnen/hosts) — puur speler.
- Buffer-config-keys kloppen tegen mpegts.js 1.8.0 / hls.js 1.6.16 (geverifieerd).
- Abort-handling bij snel bronwisselen, migratie legacy-bron, 0/1-bron-paden: correct.
- Geen page-level horizontale scroll; overlay-z-index dekt de navbar; scrollLock stapelt.
- GuideGrid-tijdberekening: geen off-by-one; width-clamp vangt overlap af.

---

## Aanbevolen volgorde
1. **P0** (snel + blokkerend): STORAGE_KEYS, `Promise.allSettled`, en de proxy-hardening
   inplannen vóór welke publieke hosting dan ook.
2. **P1**: virtualisatie (grid + GuideGrid) — één hefboom die perf, geheugen én de
   EPG-storm tegelijk aanpakt — daarna native buffering, merge-dedupe-fixes en de
   catalogus-clone/memoisatie.
3. **P1/P2 legacy-CSS**: bepaal eerst de realistische minimale TV-engine; dat bepaalt
   hoeveel CSS-fallbacks nodig zijn.
