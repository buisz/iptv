# Platform-ondersteuning & distributie

Beslisdocument voor Buisz IPTV: welke TV-platformen we ondersteunen, waarom, en
hoe we het breed inzetbaar maken — inclusief de optimalisaties voor oudere
toestellen. Gebaseerd op onderzoek (stand 2025–2026); bronnen onderaan.

## TL;DR

- **Eén React-web-app** is de kern. Die verpakken we per platform: `.wgt` (Samsung
  Tizen), `.ipk` (LG webOS) en een **WebView-schil/Capacitor-APK** (Android TV /
  Google TV / Fire OS). Dezelfde build draait ook op een externe box.
- **Officiële ondergrens: modeljaar ~2017** (Tizen 3.0 / Chromium M47, webOS 3.5 /
  Chromium 38). Daarvoor zorgt de **ES5/legacy-build** (`@vitejs/plugin-legacy`).
- **Ouder dan 2017** (Samsung Orsay, LG NetCast, vroege Tizen 2.x/webOS 1–2,
  Fire OS 5): **niet** native ondersteunen — daar verwijzen we naar een
  **externe box** (Android TV / Fire TV / Google TV-dongle). Dat is breder
  inzetbaar én goedkoper in onderhoud dan bevroren oude engines najagen.

## Twee werelden: het is niet "allemaal React"

| Platform | OS | App-model | Talen | React? |
|---|---|---|---|---|
| **Samsung Tizen** | Linux + Chromium-fork | **Web-app** (`.wgt`) | HTML/CSS/JS (C/C++, C# legacy) | ✅ als web-app |
| **LG webOS** | Linux + Chromium-fork | **Web-app** (`.ipk`) | HTML/CSS/JS | ✅ — LG's **Enact** is op React gebouwd |
| **Google TV / Android TV** | Android | **Native APK** | Kotlin/Java (+ Compose for TV) | ⚠️ via WebView-schil of `react-native-tvos` |
| **Amazon Fire TV (Fire OS)** | Android-fork | Native APK | Kotlin/Java, RN, HTML5 | ⚠️ idem |
| **Amazon Vega OS** *(nw. okt 2025)* | Linux, géén Android | React Native (`.vpkg`) | ❌ **geen DOM** — web-React draait niet |
| **Apple tvOS** | Darwin | Native | Swift/Obj-C | ⚠️ alleen via WKWebView of `react-native-tvos` |

**Kern:** Tizen en webOS zíjn web-platformen → onze React-web-app is daar de native
app. Android TV/Fire OS zijn echt Android (native = Kotlin/Java); React draait daar
via een WebView-schil. Vega OS (alle nieuwe Fire Sticks vanaf okt 2025) heeft geen
browser-DOM en vereist een aparte React-Native-port.

## Support-matrix (gelaagd)

| Tier | Toestellen | Engine | Aanpak | Oordeel |
|---|---|---|---|---|
| **Modern** | Samsung 2021+, LG 2020+, recente boxen | Chromium 76+ | Moderne bundel, native video + hls.js | ✅ haalbaar |
| **Midden (2017–2020)** | Tizen 3.0+, webOS 3.5+, Android 7+ | Chromium 38–76 | **ES5-legacy-bundel** + polyfills, virtualisatie | ✅ haalbaar met moeite ← **ondergrens** |
| **Zwak (2015–2016)** | Tizen 2.3/2.4, webOS 1/2, Fire OS 5 | WebKit, ES5-only | best-effort, sideload-only | ⚠️ zelden de moeite |
| **Oudst (pre-2015)** | Samsung Orsay, LG NetCast | oude WebKit | store dicht, EOL-tooling | ❌ → externe box |

> **Cruciaal:** elke smart-TV **bevriest zijn browser-engine bij productie en
> update die nooit**. Een 2016-toestel blijft eeuwig op WebKit/ES5. De engine, niet
> onze code, bepaalt de grens.

### Wat we officieel ondersteunen

- ✅ **Tier Modern + Midden** (≈ TV's vanaf 2017) — via de web-app + legacy-build.
- 🔌 **Elke oudere/andere TV** — via een **externe box** met dezelfde web-app
  (verpakt als Android TV/Fire OS WebView-APK). Dit is de "breed inzetbaar"-route:
  elke TV met HDMI werkt, ongeacht leeftijd, codec of merk.
- 🟡 **Tier Zwak** — best-effort, alleen via sideload; geen garanties, geen
  store-route. We investeren hier niet in, maar de ES5-build vergroot de kans dat
  het toch laadt.

## Optimalisaties voor oudere platformen

Wat al in de codebase zit:

1. **ES5/legacy-transpile** — `@vitejs/plugin-legacy` (zie `vite.config.ts`) bouwt
   naast de moderne bundel een **ES5-bundel met SystemJS + core-js-polyfills**.
   Oude engines (zonder ES-module-support) vallen via `nomodule` automatisch op die
   bundel terug. Targets staan in `.browserslistrc` (`chrome >= 38` als ondergrens).
2. **`modernPolyfills`** — ook de moderne bundel wordt gepolyfilld, want webOS 6
   (Chromium 79) en Tizen 2021 (M76) missen bijv. `String.prototype.replaceAll`
   (Chrome 85).
3. **Geen riskante runtime-API's in de bron** — bijv. `replaceAll` vervangen door
   `split().join()`, en `AbortController` met een `typeof`-guard (ontbreekt < Chromium 66).
4. **fetch/regenerator-polyfills** — `whatwg-fetch` (Chrome < 42) en
   `regenerator-runtime` (async/await → ES5) als extra legacy-polyfills.
5. **Lui geladen afspeelmotoren** — `hls.js` en `mpegts.js` zitten in aparte chunks
   en laden alleen bij afspelen, zodat de eerste render licht blijft.
6. **Remote/D-pad-navigatie** — eigen spatial-navigation (geen muis op TV).

Richtlijnen voor doorontwikkeling op zwakke hardware (krap RAM, trage SoC, agressieve GC):

- **DOM klein houden** (< ~1500 nodes) en **lange lijsten virtualiseren**
  (kanaallijst/EPG) — bv. met `react-window`. Vermijd grote re-renders.
- **Geheugen sparen**: afbeeldingen lui laden op juiste resolutie, listeners en
  beelden opruimen, snelle/grote allocaties vermijden (GC-pauzes).
- **CSS-transforms** (`translate3d`) i.p.v. JS-animaties; dure layout/reflow vermijden.
- **Video aan de native pipeline** geven (Tizen AVPlay / webOS media / ExoPlayer)
  met **hls.js (H.264/AAC)** als universele fallback. Oude TV-*browsers* doen geen
  HEVC, maar de *native* decoder vaak wél — dus per-modeljaar een codec-fallback.
- **Preact overwegen** (`preact/compat`) voor de zwakste targets: minder geheugen en
  parse-tijd dan React, grotendeels API-compatibel.
- **Testen op het oudste modeljaar** in de matrix — engines verschillen wezenlijk
  per jaar; een emulator dekt dit niet volledig.

### Het omslagpunt: wanneer React niet meer kan

- Tot **~2017** werkt React/Preact-op-de-DOM prima, mits ES5-transpile + polyfills.
- Wordt de **UI grafisch zwaar** (veel gelijktijdige animaties, dichte carousels) of
  hapert de DOM op zwakke SoC's → overweeg **Lightning JS** (WebGL-renderer i.p.v.
  DOM, gebouwd voor set-top-boxen, draait terug tot Chrome 38). Tradeoff: eigen
  rendermodel, je herschrijft de UI-laag, kleiner ecosysteem. Bewust kiezen, geen default.
- **Pre-2017 / Orsay / NetCast** vallen buiten React → **externe box**.

## Packaging-targets

| Doel | Output | Tool | Status |
|---|---|---|---|
| Web / self-host | `dist/` + `/__proxy` | `npm run build:proxy` + `npm run serve` | ✅ werkt |
| Samsung Tizen | `.wgt` | Tizen Studio / `tizen` CLI (signeren met Samsung-cert) | 🔜 build is geschikt |
| LG webOS | `.ipk` | webOS CLI (`ares-package`) | 🔜 build is geschikt |
| Android TV / Fire OS | APK (WebView/Capacitor) | Android SDK + Gradle | 🔜 vereist native schil |
| Externe box | dezelfde APK / web | — | ✅ aanbevolen voor oude TV's |

De web-build (`npm run build`) levert nu al **modern + ES5-legacy** in één keer; die
output is de basis voor het `.wgt`/`.ipk`-pakket (statische `dist/` + een platform-
manifest). De native Android-schil (Capacitor) is de eerstvolgende concrete stap en
is bewust nog niet in de repo gescaffold (vereist Android SDK/Gradle).

## Bekende beperkingen & onzekerheden

- **Echte-hardware-tests ontbreken** — de ES5-build is geverifieerd (0 arrow
  functions/`const` in de legacy-chunk), maar gedrag op echte oude Tizen/webOS-
  toestellen moet per modeljaar getest worden.
- **Exacte engine-versies** verschillen licht per bron; Tizen 3.0 = Chromium M47 is
  bevestigd, latere mappings minder hard.
- **DRM** is voor onze IPTV/M3U-usecase (vaak clear streams) minder kritisch dan voor
  premium-OTT; oude toestellen missen moderne Widevine/PlayReady.
- **Bundle-grootte**: de legacy-polyfills + `hls.js`/`mpegts.js` maken de legacy-
  chunks fors. Ze laden lui, maar voor de zwakste tier blijft geheugen het risico.

## Bronnen

- Samsung — [Web Engine Specs](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html) · [React-web-app guide](https://developer.samsung.com/smarttv/develop/tools/webapp/webapp-guide.html) · [Legacy (Orsay) FAQ — submissie dicht](https://developer.samsung.com/tv-seller-office/faq/application-registration.html)
- LG — [webOS Web Engine](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine) · [Enact (React)](https://enactjs.com/)
- Google — [Android TV get-started](https://developer.android.com/training/tv/get-started/create) · [react-native-tvos](https://github.com/react-native-tvos/react-native-tvos)
- Amazon — [Vega OS aankondiging](https://developer.amazon.com/apps-and-games/blogs/2025/09/announcing-vega-os)
- [Lightning JS renderer](https://github.com/lightning-js/renderer) · [@vitejs/plugin-legacy](https://github.com/vitejs/vite/tree/main/packages/plugin-legacy)
