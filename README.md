# Buisz · IPTV

Een **IPTV-player** in Netflix-stijl voor je eigen **M3U/M3U8-playlists** en de
**Xtream Codes API**. Eigen Buisz-merkidentiteit — geen kloon van bestaande apps.

> **Buisz is een speler, geen contentbron.** De app bevat of levert zelf geen
> streams of zenders. Je laadt je eigen legale playlist (M3U-URL, M3U-bestand of
> Xtream-inloggegevens). Er is geen koppeling met of distributie van illegale
> contentbronnen.

## Status: fase 1 — visueel prototype

Dit is het **visuele prototype** met **demodata** (`src/data/mockContent.ts`).
Bedoeld om de look-and-feel te beoordelen voordat de echte API-laag erin komt.
Er worden geen echte streams afgespeeld.

### Aan de slag

```bash
npm install
npm run dev      # start op http://localhost:5173
```

Andere scripts:

```bash
npm run build    # type-check (tsc) + productie-build
npm run preview  # bekijk de productie-build lokaal
```

## Wat zit erin (fase 1)

- **NavBar** — vaste, vervagende balk met sectie-tabs (Home / Live TV / Films / Series).
- **HeroBanner** — uitgelichte content met scrim, metadata en CTA's.
- **ContentRow** — horizontaal scrollende rijen met snap en scroll-knoppen.
- **PosterCard** — poster/thumbnail met duidelijke **focus-highlight** (Buisgroen),
  live-badges en voortgangsbalk voor "Verder kijken".
- **DetailOverlay** — detailvenster met synopsis, cast, genres en afleveringenlijst.

### Bediening / TV-navigatie

- **Pijltjestoetsen** navigeren door de poster-rijen (spatial navigation), **Enter**
  opent het detailvenster, **Esc** sluit het. Werkt zo ook met een afstandsbediening.
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
  components/   NavBar, HeroBanner, ContentRow, PosterCard, DetailOverlay
  data/         mockContent.ts   — demodata voor het prototype
  hooks/        useSpatialNav.ts — pijltjes-/remote-navigatie
  styles/       tokens.css       — Buisz-kleur/type-tokens
  types/        content.ts       — bron-agnostische content-typen
  App.tsx
  main.tsx
```

## Volgende fases

- **Fase 2 — werkende client:** `src/api/` met `xtream.ts` (Xtream-client),
  `m3u.ts` (M3U/M3U_plus-parser) en `tmdb.ts` (metadata-verrijking), gekoppeld aan
  deze UI via de bestaande `content.ts`-typen. Live-URL-formaat wordt configureerbaar
  (providers verschillen). Let op CORS bij echte servers — lokaal draaien of een
  kleine dev-proxy lost dit op.
- **Fase 3 — distributie:** richting een externe box (Android TV-box / Fire Stick /
  Apple TV via HDMI) in plaats van losse native TV-platforms.

## Tech

React 18 · Vite 5 · TypeScript · Tailwind CSS 3.
