# Buisz · IPTV

Een **IPTV-player** in Netflix-stijl voor je eigen **M3U/M3U8-playlists** en de
**Xtream Codes API**. Eigen Buisz-merkidentiteit — geen kloon van bestaande apps.

> **Buisz is een speler, geen contentbron.** De app bevat of levert zelf geen
> streams of zenders. Je laadt je eigen legale playlist (M3U-URL, M3U-bestand of
> Xtream-inloggegevens). Er is geen koppeling met of distributie van illegale
> contentbronnen.

## Status: fase 3 — distributie (box-first)

De Netflix-stijl UI uit fase 1 is gekoppeld aan echte bronnen (fase 2), en fase 3
maakt 'm klaar voor een **externe box** (Android TV / Fire Stick / Apple TV via HDMI):
EPG (nu/straks), afstandsbediening-navigatie incl. back-knop, installeerbaarheid (PWA),
en een productie-proxy voor web-deploys. Standaard start de app met **demodata**
(`src/data/mockContent.ts`); via **Bron toevoegen** (rechtsboven) laad je je eigen
**M3U-playlist**, **M3U-bestand** of **Xtream-account**.

### Aan de slag

```bash
npm install
npm run dev      # start op http://localhost:5173
```

Andere scripts:

```bash
npm run build        # type-check (tsc) + productie-build (modern + ES5-legacy)
npm run preview      # bekijk de productie-build lokaal
npm run build:proxy  # build met de productie-proxy ingeschakeld (VITE_PROXY_BASE=/__proxy)
npm run serve        # serveer dist/ + /__proxy met server/proxy.mjs (poort 4173)
```

Elke build levert **twee bundels**: een moderne ES2015-modulebundel én een
**ES5-legacy-bundel** met polyfills (via `@vitejs/plugin-legacy`), zodat oude
TV-engines (Tizen 3.0/Chromium M47, LG webOS 3.5/Chromium 38) de app via `nomodule`
kunnen laden. De support-matrix, optimalisaties en distributiekeuzes staan in
**[`docs/platforms.md`](docs/platforms.md)**.

### Een bron laden

1. Klik rechtsboven op de bron-knop (toont de actieve bron, standaard "Demo-bron").
2. Kies een tabblad:
   - **Xtream** — host, poort, gebruikersnaam, wachtwoord. Het **live-URL-formaat**
     is instelbaar (`.ts`, `.m3u8`, zonder `/live/`, of een eigen template) omdat
     providers hierin verschillen.
   - **M3U-URL** — directe link naar een `.m3u`/`.m3u8`, met optionele EPG-URL.
   - **M3U-bestand** — upload een lokale playlist.
3. Optioneel: een **TMDB-sleutel** om kale titels te verrijken met poster,
   omschrijving en cast (lui geladen bij het openen van een detail).

De bron wordt lokaal bewaard (`localStorage`); Xtream-gegevens verlaten je apparaat niet.

> **CORS:** echte Xtream-servers en M3U-URL's sturen geen CORS-headers. In dev
> haalt een ingebouwde proxy (`/__proxy`, zie `vite.config.ts`) ze server-side op.
> Afspelen van streams in de browser kan alsnog door CORS geblokkeerd worden — op
> de doel-box (Android TV / Fire Stick) speelt dit rechtstreeks af.

## Wat zit erin

**UI (fase 1):**

- **NavBar** — sectie-tabs + bronkiezer met de actieve bron.
- **HeroBanner** — uitgelichte content met scrim, metadata en CTA's.
- **ContentRow** — horizontaal scrollende rijen met snap en scroll-knoppen.
- **PosterCard** — poster/thumbnail met **focus-highlight** (Buisgroen),
  live-badges en voortgangsbalk; vangt ontbrekende beelden netjes op.
- **DetailOverlay** — synopsis, cast, genres, afleveringenlijst en afspeelknoppen.

**Client (fase 2):**

- **`api/xtream.ts`** — Xtream-client: `player_api.php`-acties, configureerbaar
  live-URL-formaat, mappers naar het content-model, lui geladen series-info.
- **`api/m3u.ts`** — M3U/M3U_plus-parser: `tvg-*`/`group-title`-attributen,
  `x-tvg-url` EPG, classificatie live/film/serie, groepering naar rijen.
- **`api/tmdb.ts`** — optionele metadataverrijking via TMDB.
- **`api/catalog.ts`** + **`hooks/useCatalog.ts`** — bron-agnostische lader met
  persistentie en demo als standaard.
- **`components/Player.tsx`** — speler met `hls.js` (HLS) en `mpegts.js` (MPEG-TS),
  native fallback; libs worden lui geladen (aparte chunks).
- **`components/SourceModal.tsx`** — scherm om een bron te kiezen/laden.

**Distributie (fase 3):**

- **`api/epg.ts`** — XMLTV-parser; toont "nu/straks" op live-kanalen (poster +
  detail) op basis van `x-tvg-url` of een opgegeven EPG-URL.
- **`server/proxy.mjs`** — productie-server: serveert `dist/` + dezelfde
  `/__proxy` CORS-proxy, zodat web-deploys ook met echte bronnen werken.
- **PWA-manifest** (`public/manifest.webmanifest`) — fullscreen, installeerbaar op
  een box of telefoon.

### Bediening / TV-navigatie

- **Pijltjestoetsen** navigeren door de poster-rijen (spatial navigation); **omhoog**
  vanaf de bovenste rij springt naar de navigatiebalk. **Enter** opent, **Esc** of
  **Backspace** (de back-knop van een afstandsbediening) sluit de bovenste overlay.
- Zichtbare focus-highlight, responsive tot mobiel, en `prefers-reduced-motion`
  wordt gerespecteerd.

## Designrichting

Eigen identiteit met de gangbare streaming-UX-patronen (donkere achtergrond,
hero-banner, horizontale categorie-rijen, focus-highlight, detail-overlay). Het
Buisz-palet maakt het onmiskenbaar geen kloon:

| Token      | Kleur     | Rol                                   |
| ---------- | --------- | ------------------------------------- |
| Antraciet  | `#13181b` | Basis / achtergrond                   |
| Diepteal   | `#0e4f4a` | Diepte / sfeergloed                   |
| Buisgroen  | `#34e3a8` | Signature-accent (focus, CTA, live)   |
| Mist       | `#e9f1f0` | Voorgrond / tekst                     |

Tokens staan in `src/styles/tokens.css` en `tailwind.config.js`.

## Projectstructuur

```
src/
  api/          xtream.ts, m3u.ts, tmdb.ts, epg.ts, catalog.ts, proxy.ts
  components/   NavBar, HeroBanner, ContentRow, PosterCard, DetailOverlay,
                SourceModal, Player
  data/         mockContent.ts   — demodata (demo-bron)
  hooks/        useSpatialNav.ts — pijltjes-/remote-navigatie
                useCatalog.ts    — actieve bron + catalogus + EPG + persistentie
  styles/       tokens.css       — Buisz-kleur/type-tokens
  types/        content.ts       — bron-agnostische content-typen
                source.ts        — bron-configuratie
  App.tsx
  main.tsx
server/
  proxy.mjs     — productie-server + CORS-proxy
platforms/      — Tizen config.xml, webOS appinfo.json, iconen
scripts/        — gen-icons, package-tizen, package-webos
android/        — Capacitor Android TV-schil (TV-manifest)
```

## Distributie (box-first, breed inzetbaar)

Eén web-app, per platform verpakt. Volledige onderbouwing + support-matrix:
**[`docs/platforms.md`](docs/platforms.md)**.

```bash
# Web / self-host (externe box of browser)
npm run build:proxy && npm run serve   # http://localhost:4173 (dist/ + /__proxy)

# Samsung Tizen  → build/buisz.wgt  (ongetekend; signeren via Tizen Studio)
npm run package:tizen

# LG webOS       → build/app.buisz.iptv_*.ipk  (via ares-package)
npm run package:webos

# Android TV / Google TV / Fire OS  → Capacitor-schil in android/
npm run android:sync     # kopieert de web-build naar de schil
npm run android:open     # verder bouwen met Android Studio + Android SDK/Gradle
```

De Tizen/webOS-pakketten en de Capacitor-schil worden gegenereerd uit dezelfde
web-build. De **APK zelf** bouw je met de Android SDK/Gradle (lokaal, niet in deze
repo-build). De `android/`-`AndroidManifest.xml` is al voor TV ingericht
(`LEANBACK_LAUNCHER`, `android:banner`, touch/leanback `required="false"`).

> Waarom box-first: oude én nieuwe TV's met **één codebase**, en de box levert de
> moderne codecs (HEVC/HLS/MPEG-TS) die veel oude TV's missen. Voor te oude TV's is
> de externe box de aanbevolen route i.p.v. bevroren engines najagen.

## Tech

React 18 · Vite 5 · TypeScript · Tailwind CSS 3 · hls.js · mpegts.js ·
@vitejs/plugin-legacy (ES5-build voor oude TV's).
