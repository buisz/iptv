# Buisz koppel-Worker (Cloudflare)

Kleine Cloudflare Worker voor:

1. **QR-koppeling** — koppel je M3U/Xtream-bron vanaf je telefoon aan je TV/box.
2. **Stream-/CORS-proxy** (`/proxy?url=…`) — zodat live ook in een web-deploy werkt.

De relay bewaart een bron **alleen kortstondig** (KV met TTL) en verwijdert 'm zodra
de TV 'm heeft opgehaald (single-use). Geen database, geen accounts.

## Endpoints

| Methode | Pad | Door | Doel |
|---|---|---|---|
| POST | `/api/session` | TV/box | Maakt een sessie → `{ code, pairUrl }` |
| GET | `/api/session/:code` | TV/box | Polt; geeft `{ source }` zodra ingediend (en wist 'm) |
| POST | `/api/session/:code` | telefoon | Dient de bron in |
| GET | `/p/:code` | telefoon | Invoerpagina (geopend via de QR) |
| GET | `/proxy?url=` | app/web | Streamende CORS-proxy |

## Deployen (jij, met je eigen Cloudflare-account)

```bash
npm i -g wrangler            # of: npx wrangler ...
cd worker
wrangler login

# 1) KV-namespace aanmaken en het id in wrangler.toml zetten
wrangler kv namespace create SESSIONS
#   → kopieer het "id" naar wrangler.toml (vervang VERVANG_MET_JE_KV_NAMESPACE_ID)

# 2) Deployen
wrangler deploy
#   → je krijgt een URL zoals https://buisz-pair.<jouw-subdomein>.workers.dev
```

## Koppelen aan de app

Zet de Worker-URL in de app: **Instellingen → Koppel-service (URL)** (of bij de build
via `VITE_PAIR_BASE=https://buisz-pair.<...>.workers.dev`). Daarna verschijnt in de
wizard/bronkiezer de optie **"Koppel via QR-code"**.

## Privacy

Inloggegevens passeren de relay kort. Houd de TTL klein (standaard 5 min). Voor een
publieke host: overweeg end-to-end-encryptie met de code als sleutel, zodat de server
de inhoud niet kan lezen.
