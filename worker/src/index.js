/**
 * Buisz koppel-Worker (Cloudflare Worker).
 *
 * Twee functies:
 *  1) QR-koppeling: een TV/box maakt een sessie (kort geldige code), toont een QR
 *     naar /p/<code>. Op je telefoon vul je daar je M3U/Xtream-bron in; de TV polt
 *     en past 'm toe. De relay bewaart de bron alleen kort (KV TTL) en verwijdert
 *     'm zodra de TV 'm heeft opgehaald (single-use).
 *  2) Stream-/CORS-proxy op /proxy?url=… (streamt door), zodat live ook in een
 *     web-deploy werkt.
 *
 * Vereist een KV-namespace gebonden als `SESSIONS` (zie wrangler.toml).
 *
 * PRIVACY: inloggegevens passeren de relay kortstondig. Houd de TTL klein en
 * overweeg end-to-end-encryptie (code als sleutel) als je dit publiek host.
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // zonder I/O/0/1
const SESSION_TTL = 300 // seconden

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extra },
  })
}

function genCode(len = 6) {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return out
}

/** User-Agent voor upstream-verzoeken (VLC — veel Xtream-panels eisen een speler-UA). */
const STREAM_UA = 'VLC/3.0.20 LibVLC/3.0.20'

/** Ziet dit antwoord eruit als een foutpagina i.p.v. video? (HTML/JSON/XML). */
function looksLikeErrorPage(contentType) {
  const ct = (contentType || '').toLowerCase()
  return ct.includes('text/html') || ct.includes('application/json') || ct.includes('application/xml')
}

/** Is dit waarschijnlijk een m3u8-playlist? (content-type of extensie). */
function isM3u8(contentType, targetUrl) {
  const ct = (contentType || '').toLowerCase()
  if (ct.includes('mpegurl')) return true
  try {
    const u = new URL(targetUrl)
    return /\.m3u8(\?|$)/i.test(u.pathname + u.search)
  } catch {
    return /\.m3u8(\?|$)/i.test(targetUrl || '')
  }
}

/**
 * Maakt elke segment-/URI-verwijzing in een HLS-playlist absoluut t.o.v. baseUrl,
 * zodat de speler ze zelf weer door de proxy kan sturen (i.p.v. relatief t.o.v.
 * het proxy-pad, wat kapot zou gaan).
 */
function rewriteM3u8(text, baseUrl) {
  const abs = (u) => {
    try {
      return new URL(u, baseUrl).toString()
    } catch {
      return u
    }
  }
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]*)"/g, (_m, u) => `URI="${abs(u)}"`)
      }
      return abs(trimmed)
    })
    .join('\n')
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const { pathname } = url

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

    // ── Stream-/CORS-proxy ──────────────────────────────────────────────
    if (pathname === '/proxy') {
      const target = url.searchParams.get('url')
      const isStream = url.searchParams.get('stream') === '1'
      if (!target) return new Response('missing url', { status: 400, headers: CORS })
      const headers = new Headers({ 'User-Agent': STREAM_UA })
      const range = request.headers.get('range')
      if (range) headers.set('range', range)
      const upstream = await fetch(target, { headers, redirect: 'follow' })
      const contentType = upstream.headers.get('content-type')

      // HLS-manifest: herschrijf de URI's naar absoluut, zodat de speler ze
      // vervolgens zelf weer door /proxy stuurt (segmenten blijven streamen).
      if (isM3u8(contentType, target)) {
        const text = rewriteM3u8(await upstream.text(), target)
        const h = new Headers(CORS)
        h.set('content-type', contentType || 'application/vnd.apple.mpegurl')
        h.set('cache-control', 'no-store')
        return new Response(text, { status: upstream.status, headers: h })
      }

      // Foutpagina i.p.v. video (HTML/JSON): eerlijke 502 met snippet.
      // Alleen voor stream-verzoeken — API-calls geven legitiem JSON terug.
      if (isStream && looksLikeErrorPage(contentType)) {
        const snippet = (await upstream.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
        const h = new Headers(CORS)
        h.set('content-type', 'text/plain; charset=utf-8')
        return new Response(`Upstream gaf een foutpagina i.p.v. video: ${snippet || '(leeg)'}`, { status: 502, headers: h })
      }

      const respHeaders = new Headers(CORS)
      for (const h of ['content-type', 'content-range', 'accept-ranges', 'content-length']) {
        const v = upstream.headers.get(h)
        if (v) respHeaders.set(h, v)
      }
      respHeaders.set('cache-control', 'no-store')
      return new Response(upstream.body, { status: upstream.status, headers: respHeaders })
    }

    // ── Koppel-API ──────────────────────────────────────────────────────
    // Nieuwe sessie aanmaken (door de TV/box).
    if (pathname === '/api/session' && request.method === 'POST') {
      let code = genCode()
      // (Botskans is verwaarloosbaar; in de praktijk niet checken.)
      await env.SESSIONS.put(`sess:${code}`, JSON.stringify({ created: Date.now() }), {
        expirationTtl: SESSION_TTL,
      })
      return json({ code, pairUrl: `${url.origin}/p/${code}`, expiresIn: SESSION_TTL })
    }

    // /api/session/<code> : GET = TV polt; POST = telefoon dient bron in.
    const m = pathname.match(/^\/api\/session\/([A-Z0-9]{4,10})$/i)
    if (m) {
      const code = m[1].toUpperCase()
      const key = `sess:${code}`
      const raw = await env.SESSIONS.get(key)
      if (!raw) return json({ error: 'expired' }, 404)
      const sess = JSON.parse(raw)

      if (request.method === 'POST') {
        let body
        try {
          body = await request.json()
        } catch {
          return json({ error: 'bad json' }, 400)
        }
        if (!body || !body.source || !body.source.kind) return json({ error: 'no source' }, 400)
        sess.source = body.source
        await env.SESSIONS.put(key, JSON.stringify(sess), { expirationTtl: SESSION_TTL })
        return json({ ok: true })
      }

      // GET: lever de bron op zodra die er is, en verwijder 'm (single-use).
      if (sess.source) {
        await env.SESSIONS.delete(key)
        return json({ source: sess.source })
      }
      return json({ pending: true })
    }

    // ── Telefoonpagina ──────────────────────────────────────────────────
    const p = pathname.match(/^\/p\/([A-Z0-9]{4,10})$/i)
    if (p) {
      return new Response(phonePage(p[1].toUpperCase()), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    }

    if (pathname === '/') {
      return new Response('Buisz koppel-service. Gebruik de app om te koppelen.', {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }

    return new Response('Not found', { status: 404, headers: CORS })
  },
}

/** Minimalistische, Buisz-getinte telefoonpagina (geen build, inline). */
function phonePage(code) {
  return `<!doctype html><html lang="nl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#13181b"><title>Buisz koppelen</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,sans-serif;background:#0c1012;color:#e9f1f0;display:flex;justify-content:center}
.wrap{width:100%;max-width:460px;padding:24px}
h1{font-size:22px;margin:8px 0 4px}
p.sub{color:#9fb2b1;font-size:14px;margin:0 0 20px}
.tabs{display:flex;gap:8px;margin-bottom:16px}
.tabs button{flex:1;padding:8px;border-radius:999px;border:0;font-weight:700;background:#1b2227;color:#9fb2b1}
.tabs button.on{background:#34e3a8;color:#0c1012}
label{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#74898a;margin:12px 0 4px}
input{width:100%;padding:12px;border-radius:10px;border:1px solid #ffffff1a;background:#0c1012;color:#e9f1f0;font-size:15px}
.row{display:flex;gap:10px}
button.go{width:100%;margin-top:20px;padding:14px;border-radius:999px;border:0;background:#34e3a8;color:#0c1012;font-weight:800;font-size:16px}
.ok{text-align:center;padding:40px 0}
.ok .big{font-size:40px}
.hide{display:none}
.tag{display:inline-block;background:#1b2227;border-radius:6px;padding:2px 8px;font-size:12px;color:#9fb2b1}
</style></head><body><div class="wrap">
<h1>Buisz koppelen</h1>
<p class="sub">Code <span class="tag">${code}</span> · vul je eigen legale bron in. Toevoegen gebeurt op je TV.</p>
<div id="form">
  <div class="tabs">
    <button id="t-x" class="on" onclick="setTab('x')">Xtream</button>
    <button id="t-m" onclick="setTab('m')">M3U-URL</button>
  </div>
  <div id="pane-x">
    <label>Host</label><input id="host" placeholder="voorbeeld.tv" autocomplete="off">
    <div class="row"><div style="flex:1"><label>Poort</label><input id="port" inputmode="numeric" placeholder="8080"></div>
    <div style="flex:1"><label>https?</label><input id="secure" placeholder="nee/ja"></div></div>
    <label>Gebruikersnaam</label><input id="user" autocomplete="off">
    <label>Wachtwoord</label><input id="pass" type="password" autocomplete="off">
  </div>
  <div id="pane-m" class="hide">
    <label>M3U-URL</label><input id="m3u" placeholder="https://…/playlist.m3u" autocomplete="off">
  </div>
  <button class="go" onclick="submit()">Toevoegen op TV</button>
</div>
<div id="done" class="ok hide"><div class="big">✓</div><p>Toegevoegd op je TV!</p><p class="sub">Je kunt dit venster sluiten.</p></div>
<script>
var tab='x';
function setTab(t){tab=t;document.getElementById('t-x').className=t==='x'?'on':'';document.getElementById('t-m').className=t==='m'?'on':'';document.getElementById('pane-x').className=t==='x'?'':'hide';document.getElementById('pane-m').className=t==='m'?'':'hide';}
function val(id){return (document.getElementById(id).value||'').trim();}
function buildSource(){
  if(tab==='x'){
    if(!val('host')||!val('user')||!val('pass'))return null;
    var sec=/^(ja|yes|https|true|1)$/i.test(val('secure'));
    return {kind:'xtream',host:val('host').replace(/^https?:\\/\\//,'').replace(/\\/.*$/,''),port:val('port')?Number(val('port')):undefined,secure:sec,username:val('user'),password:val('pass')};
  }
  if(!val('m3u'))return null;
  return {kind:'m3u-url',url:val('m3u')};
}
function submit(){
  var s=buildSource(); if(!s){alert('Vul de velden in.');return;}
  fetch('/api/session/${code}',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source:s})})
   .then(function(r){if(!r.ok)throw 0;document.getElementById('form').classList.add('hide');document.getElementById('done').classList.remove('hide');})
   .catch(function(){alert('Mislukt of code verlopen. Vraag een nieuwe QR op je TV.');});
}
</script></div></body></html>`
}
