# Live-afspelen testen & valideren

Reproduceerbare manier om live-afspelen te testen — met name de
`[MSEController] > MediaSource onSourceEnded`-regressie en de "Naar live"-knop —
**zonder** een betaalde IPTV-provider. We draaien een lokale synthetische live
MPEG-TS-bron door dezelfde `/__proxy` als een echte zender.

## Wat we fixten (context)
- **Oorzaak 1 (proxy):** de proxy gaf `content-length` van een live `.ts` door.
  mpegts.js leest dan exact zoveel bytes, denkt "download klaar" en roept
  `MediaSource.endOfStream()` aan → de zender stopt (op **elk** kanaal). Fix: op
  live-streams (geen `Range`) adverteren we geen eindige lengte meer.
- **Oorzaak 2 (app):** de app luisterde niet naar `LOADING_COMPLETE`. Als een
  live-feed tóch eindigt, verbindt de speler nu opnieuw (begrensd, met backoff)
  i.p.v. stil te blijven hangen.
- **Neveneffect:** de region-lock-probe opent geen tweede verbinding meer bij live
  (kon een provider met max. verbindingen de zender kosten).

## 1. Synthetische live-bron starten
Vereist `ffmpeg` op PATH (gebruikt de ingebouwde `lavfi`-testbron; geen bestand
of download nodig).

```bash
node scripts/synth-live.mjs
# → Synthetische live-TS op http://127.0.0.1:7000/live/1
```

**Geen ffmpeg?** Loop een klein `.ts`-bestand dat je al hebt:
```js
// vervang de ffmpeg-spawn in synth-live.mjs door:
import { createReadStream } from 'node:fs'
function pump(res){ const s = createReadStream('scripts/loop.ts'); s.pipe(res,{end:false}); s.on('end',()=>setTimeout(()=>pump(res),40)) }
// en roep pump(res) aan i.p.v. ff.stdout.pipe(res)
```
(mpegts.js verdraagt de PTS-sprong per lus; bij fouten is de ffmpeg-route stabieler.)

## 2. Dev-server met loopback-uitzondering starten
De SSRF-guard blokkeert standaard `127.0.0.1`. Voor de test zetten we die
uitzondering **tijdelijk** aan met een env-vlag (standaard uit, nooit in productie):

```bash
BUISZ_ALLOW_LOOPBACK=1 npm run dev
```

## 3. De speler direct openen (dev-testhaak)
```
http://localhost:5173/?__testlive=http://127.0.0.1:7000/live/1
```
Dit draait de échte `Player.tsx`-code (engine-keuze, `proxied()`,
`mpegts.createPlayer`, `goLive`, de live-rand-knop) zonder bron-config.

## 4. Instrumentatie (plak in de DevTools-console vóór afspelen)
Logt de MSE-levenscyclus + `endOfStream()` + eventuele `<video>`-remounts:

```js
(() => {
  const OMS = window.MediaSource, addSB = OMS.prototype.addSourceBuffer, eos = OMS.prototype.endOfStream
  OMS.prototype.addSourceBuffer = function(t){ console.log('[MSE] addSourceBuffer', t, 'state=', this.readyState); return addSB.call(this,t) }
  OMS.prototype.endOfStream = function(r){ console.warn('[MSE] endOfStream()', r, new Error().stack.split('\n')[2]); return eos.call(this,r) }
  const wire = ms => ['sourceopen','sourceended','sourceclose'].forEach(ev => ms.addEventListener(ev, () => console.log('[MSE]', ev, 'state=', ms.readyState)))
  const orig = URL.createObjectURL
  URL.createObjectURL = function(o){ if (o instanceof OMS) wire(o); return orig.call(this,o) }
  console.log('[instrument] klaar. Gezond = 1x sourceopen, 0x sourceended, 0x endOfStream.')
})()
```

**Lezen:**
- **Gezond:** 1× `[MSE] sourceopen`, `addSourceBuffer` voor video (+audio), daarna
  stil. **Nooit** `[MSE] endOfStream()` of `sourceended`.
- **Regressie (nu gefixt):** `[MSE] endOfStream()` met een stack naar mpegts.js,
  gevolgd door `sourceended` en bevriezing. Met de fix zie je dit niet meer bij een
  continue feed; als de feed écht wegvalt, zie je in plaats daarvan een korte
  herverbinding (status → laden → speelt weer).

## 5. Validatie-checklist
1. **Start:** beeld beweegt, status-pill toont "Live", console: 1× sourceopen,
   0× endOfStream.
2. **~60 s laten lopen:** console blijft stil — géén `sourceended`, géén stop. (Dit
   is de kern van de fix: vóór de fix stopte hij hier op elk kanaal.)
3. **Pauze (native controls):** de pill links wordt groen "Naar live" (klikbaar);
   de bovenbalk blijft zichtbaar.
4. **"Naar live" klikken:** speelt vloeiend door richting de live-rand — géén
   `AbortError`, géén bevriezing, géén `endOfStream()`.
5. **~3 s niets doen tijdens afspelen:** "LIVE"-pill en bovenbalk faden weg; muis
   bewegen brengt ze terug.
6. **Herverbind-test:** stop `synth-live.mjs` (Ctrl-C) tijdens afspelen → de feed
   valt weg → de speler probeert ~5× opnieuw (met backoff). Start de bron weer →
   hij pakt de zender weer op. Blijft de bron weg, dan verschijnt na de pogingen
   een nette netwerk-/regio-melding i.p.v. een stille bevriezing.

## Opruimen
- `BUISZ_ALLOW_LOOPBACK` is alleen actief zolang je 'm zet — laat 'm weg buiten de test.
- De `?__testlive=`-haak en de loopback-uitzondering zijn dev-/env-gated en komen
  niet in de productiebuild of standaard-runtime.
