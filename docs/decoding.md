# Decoding-strategie (software/hardware) voor Buisz

Doel: betrouwbaar afspelen op een breed scala aan apparaten — van moderne boxen tot
oude TV's/STB's zónder (goede) hardware-decode — met **automatische degradatie van
kwaliteit** i.p.v. stutter/crash.

## Kernprincipe

Decode is de duurste operatie. Strategie: **detecteer device-capaciteit → kies de
juiste decode-path → schaal kwaliteit terug waar nodig → offload alles behalve decode
naar de GPU.**

## Fallback-keten

1. **Hardware decoding** (MediaCodec/Android, platform-decoder). Snelst en koelst.
2. **Detecteer falen/haperingen**: decoder-init faalt, dropped frames boven drempel,
   of bekende SoC-blacklist voor kapotte HW-decode van bepaalde codecs/profielen.
3. **Software decoding** (libavcodec) mét tuning (zie tabel).
4. **Schaal de stream terug**: forceer een lagere ABR-rendition (alleen mogelijk bij
   HLS/DASH met meerdere renditions — niet bij een enkel-bitrate `.ts`-stream).
5. **Server-side transcoding** als laatste redmiddel (zie architectuur).

### Software-decode tuning

| Parameter | Instelling | Reden |
|---|---|---|
| Thread count | = aantal CPU-cores | slice/frame-threading schaalt H.264 ~lineair |
| Codec-profiel (request) | H.264 Baseline/Main i.p.v. High | geen CABAC/B-frames = lichter |
| Resolutie/bitrate | laagste acceptabele rendition | lineaire CPU-besparing |
| Deinterlacing | uit of goedkoopste (bob) | kan duurder zijn dan de decode zelf |
| Scaling/output | naar GPU | alleen decode is duur |
| Buffer/cache | vergroten | vangt CPU-pieken op |

## Mapping op de Buisz-stack (eerlijk)

| Engine (nu) | HW-decode | SW-fallback/tuning | Conclusie |
|---|---|---|---|
| Browser: `hls.js`/`mpegts.js` (MSE) | ja, ná MSE door de browser | nee (geen libavcodec-knoppen) | alleen browser; geen fijne controle |
| App: `@capgo/...` (ExoPlayer) | **ja, standaard** | beperkt — plugin biedt **geen** `MediaCodecSelector`/FFmpeg-extension/threads | werkt, maar niet de volledige keten |

**De harde waarheid:** de huidige native plugin (ExoPlayer via `@capgo`) doet
hardware-decode prima, maar laat de **software-tuning uit de tabel niet toe** (geen
thread-count, geen `--avcodec-*`, geen expliciete HW/SW-toggle, geen deinterlace-keuze).
Voor de vólledige fallback-keten heb je een engine nodig die die knoppen blootlegt.

### Aanbeveling: libVLC als engine voor deze strategie

**libVLC** is hiervoor de natuurlijke keuze en exposeert exact de knoppen uit de tabel:

- `--avcodec-hw=` (auto/none) → HW forceren of uitzetten.
- `--avcodec-threads=` → thread-count = cores.
- `--deinterlace` + `--deinterlace-mode=bob` → goedkoopste deinterlace.
- codec/▪ via `--codec`, plus robuuste MPEG-TS-afhandeling (ideaal voor IPTV).

Veel serieuze IPTV-apps gebruiken libVLC juist hierom. Trade-off: groter/zwaarder dan
ExoPlayer, en het vervangt de huidige `@capgo`-plugin. Op Android kan dit via een
libVLC-Capacitor-plugin of een dunne native module; op de oudste TV's blijft de
platform-native player (Tizen AVPlay / webOS) leidend.

## Per-platform: hardware-offload & fallback-realiteit

Belangrijk inzicht: **software-decode-tuning (libavcodec threads/profiel/deinterlace)
is iets voor apparaten mét CPU-headroom (box/desktop) — niet voor de TV zelf.** Op een
zwakke TV-SoC is HD software-decoden sowieso niet haalbaar; als de hardware een codec
niet kan, kan de CPU het ook niet. De juiste fallback op een TV is dus **transcode of
een externe box**, niet CPU-decode.

| Platform | HW-offload | SW-fallback met tuning | Fallback bij niet-ondersteunde codec |
|---|---|---|---|
| **Tizen (Web App)** | ✅ via **AVPlay** (`webapis.avplay`) — native HW-decoder, callable vanuit de web-app, ook op oude modellen | ❌ niet in een web-app (geen libavcodec/threads); ook niet zinvol op TV-CPU | **server-side transcode** of box |
| **webOS (Web App)** | ✅ via de native media-pipeline | ❌ idem | transcode / box |
| **Android-box** | ✅ ExoPlayer/libVLC | ✅ **libVLC** (HW→SW-tuned) — hier heeft het zin | libVLC-SW of transcode |
| **Browser** | ✅ ná MSE | ❌ | transcode / native client |

### Wat dit betekent voor Tizen

- **Web Application is en blijft de juiste keuze.** Native C/C++ (`.tpk`) op Tizen levert
  je géén bruikbare SW-fallback op (HD-CPU-decode werkt niet op oude TV's) en kost een
  aparte codebase — niet de moeite.
- De hardware-offload haal je uit **AVPlay**, niet uit `<video>`/mpegts.js. AVPlay
  speelt MPEG-TS/HLS met de **hardware-decoder** af (zoals op de box ExoPlayer dat doet).
  Bestaat al sinds vroege Tizen, dus ook oude modellen profiteren.
- De UI draait op de ES5-legacy-build; alléén het decoden gaat naar AVPlay. Codecs die
  de TV-hardware niet kent → **transcode of box**, niet de CPU.

→ Roadmap-gevolg: een **AVPlay-engine** in `src/api/player/` (naast de browser- en
ExoPlayer/libVLC-engines). De `liveFormat`-keuze (HLS prefereren) en server-transcode
zijn de fallback-knoppen op TV, niet thread-count/deinterlace.

## Architectuur — de echte oplossing voor onmogelijke combos

Voor codecs/resoluties die het device **nooit** aankan (HEVC/4K op H.264-only hardware):
verplaats de last.

- **Server-side transcoding**: een sterke machine (homelab/server) zet realtime om naar
  H.264 Baseline / lagere resolutie en serveert dat aan het zwakke apparaat
  (Jellyfin/Plex-stijl of een kale FFmpeg-restreamer). In Buisz: ondersteun een
  **per-bron transcode-/proxy-URL** zodat zo'n endpoint als gewone bron geladen wordt.
- **Tussenapparaat**: een goedkope Android-box / Pi met werkende HW-decode neemt de
  decode over; de oude TV is puur HDMI-scherm. (Dit is onze bestaande box-first lijn.)

## Roadmap / taken

Goedkoop & nu haalbaar (web + sturing):
- [ ] **Codec-aware format**: bij Xtream live `.m3u8` (HLS) i.p.v. `.ts` aanvragen waar
      mogelijk → opent de deur naar ABR-renditions; en H.264 prefereren boven HEVC.
- [ ] **Capability-detectie (web)**: `MediaCapabilities.decodingInfo()` /
      `MediaSource.isTypeSupported` om vooraf te weten of een codec smooth/​powerEfficient is.
- [ ] **Dropped-frame monitor (web)**: `video.getVideoPlaybackQuality().droppedVideoFrames`
      als trigger; bij overschrijding → lagere rendition (HLS) of duidelijke melding.

Groot & een keuze waard (native, vereist engine-besluit + device-test):
- [ ] **Engine-swap naar libVLC** op Android (fallback-keten HW→SW-tuned, thread-count
      = cores, deinterlace-keuze, expliciete HW/SW-toggle).
- [ ] **SoC-blacklist** + runtime-degradatie op basis van dropped frames.
- [ ] **Tizen AVPlay / webOS** native-paden in dezelfde afspeel-abstractie.

Infrastructuur (optioneel, jouw kant):
- [ ] **Transcode-/restream-endpoint** definiëren (FFmpeg/Jellyfin) voor onmogelijke
      combinaties; in de app als gewone bron-/proxy-URL laden.

## Besluit (vastgelegd)

**libVLC wordt de native afspeel-engine op Android** — dit is besloten, niet optioneel.
Volgorde: (1) eerst een testronde op echte hardware met de huidige opzet (ExoPlayer via
`@capgo`) om te zien wat écht hapert; (2) daarna de **engine-swap naar libVLC** met de
volledige fallback-keten (HW→SW-tuned, thread-count = cores, deinterlace, expliciete
HW/SW-toggle, SoC-blacklist). Server-side transcoding blijft de uitwijk voor combinaties
die het device fysiek nooit trekt.

De `src/api/player/`-abstractie is hier al op voorbereid: een libVLC-engine komt ernaast
zonder de UI te raken.

## Korte conclusie

De huidige stack speelt **met hardware-decode** af op moderne hardware (browser + box).
Voor zwakke hardware komt **libVLC** erin (besloten), na de testronde.
