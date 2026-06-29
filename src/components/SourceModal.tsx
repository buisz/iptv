import { useEffect, useRef, useState } from 'react'
import type { Source, LiveFormatPreset } from '../types/source'
import { getTmdbKey, setTmdbKey } from '../api/tmdb'
import { lockScroll, unlockScroll } from '../lib/scrollLock'

interface SourceModalProps {
  open: boolean
  busy: boolean
  error: string | null
  currentKind: Source['kind']
  onClose: () => void
  onApply: (source: Source) => void
  onResetDemo: () => void
}

type Tab = 'xtream' | 'm3u-url' | 'm3u-text'

const tabs: { id: Tab; label: string }[] = [
  { id: 'xtream', label: 'Xtream' },
  { id: 'm3u-url', label: 'M3U-URL' },
  { id: 'm3u-text', label: 'M3U-bestand' },
]

const liveFormats: { id: LiveFormatPreset; label: string }[] = [
  { id: 'ts', label: '.ts (standaard)' },
  { id: 'm3u8', label: '.m3u8 (HLS)' },
  { id: 'mpegts-noext', label: 'zonder /live/ en extensie' },
  { id: 'custom', label: 'eigen template' },
]

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-mist-300">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-mist-300">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-lg border border-white/10 bg-antraciet-900/60 px-3 py-2.5 text-sm text-mist placeholder:text-mist-300 outline-none transition-colors focus:border-buisgroen/60 focus:ring-2 focus:ring-buisgroen/30'

export default function SourceModal({
  open,
  busy,
  error,
  currentKind,
  onClose,
  onApply,
  onResetDemo,
}: SourceModalProps) {
  const [tab, setTab] = useState<Tab>('xtream')
  const panelRef = useRef<HTMLDivElement>(null)

  // Xtream-velden
  const [host, setHost] = useState('')
  const [xport, setXport] = useState('')
  const [secure, setSecure] = useState(false)
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [liveFormat, setLiveFormat] = useState<LiveFormatPreset>('ts')
  const [liveTemplate, setLiveTemplate] = useState(
    '{scheme}://{host}:{port}/live/{username}/{password}/{id}.ts',
  )

  // M3U-velden
  const [m3uUrl, setM3uUrl] = useState('')
  const [epgUrl, setEpgUrl] = useState('')
  const [fileText, setFileText] = useState('')
  const [fileName, setFileName] = useState('')

  // TMDB
  const [tmdb, setTmdb] = useState('')

  useEffect(() => {
    if (!open) return
    setTmdb(getTmdbKey() ?? '')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    lockScroll()
    panelRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      unlockScroll()
    }
  }, [open, onClose])

  if (!open) return null

  function persistTmdb() {
    setTmdbKey(tmdb.trim() || null)
  }

  function submit() {
    persistTmdb()
    if (tab === 'xtream') {
      if (!host.trim() || !user.trim() || !pass) return
      onApply({
        kind: 'xtream',
        host: host.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
        port: xport ? Number(xport) : undefined,
        secure,
        username: user.trim(),
        password: pass,
        liveFormat,
        liveTemplate: liveFormat === 'custom' ? liveTemplate : undefined,
      })
    } else if (tab === 'm3u-url') {
      if (!m3uUrl.trim()) return
      onApply({ kind: 'm3u-url', url: m3uUrl.trim(), epgUrl: epgUrl.trim() || undefined })
    } else {
      if (!fileText.trim()) return
      onApply({ kind: 'm3u-text', text: fileText, name: fileName || undefined })
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setFileText(await file.text())
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bron toevoegen"
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-antraciet-900/80 p-4 backdrop-blur-md animate-fade-in sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative my-6 w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)] bg-antraciet-800 shadow-2xl ring-1 ring-white/10 animate-scale-in outline-none"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-mist">Bron toevoegen</h2>
            <p className="text-xs text-mist-300">Laad je eigen legale playlist of Xtream-account.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Sluiten"
            className="grid h-9 w-9 place-items-center rounded-full text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-mist focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-buisgroen',
                tab === t.id ? 'bg-buisgroen text-antraciet-900' : 'bg-white/[0.04] text-mist-400 hover:text-mist',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-4 px-6 py-5">
          {tab === 'xtream' && (
            <>
              <Field label="Host" hint="Zonder http:// — bijv. voorbeeld.tv">
                <input className={inputCls} value={host} onChange={(e) => setHost(e.target.value)} placeholder="voorbeeld.tv" autoComplete="off" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Poort">
                  <input className={inputCls} value={xport} onChange={(e) => setXport(e.target.value)} placeholder="8080" inputMode="numeric" />
                </Field>
                <Field label="Beveiligd (https)">
                  <button
                    type="button"
                    onClick={() => setSecure((v) => !v)}
                    className={[
                      'flex h-[42px] w-full items-center justify-between rounded-lg border px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-buisgroen',
                      secure ? 'border-buisgroen/60 bg-buisgroen/10 text-mist' : 'border-white/10 bg-antraciet-900/60 text-mist-400',
                    ].join(' ')}
                  >
                    {secure ? 'https' : 'http'}
                    <span className={['h-5 w-9 rounded-full p-0.5 transition-colors', secure ? 'bg-buisgroen' : 'bg-white/15'].join(' ')}>
                      <span className={['block h-4 w-4 rounded-full bg-antraciet-900 transition-transform', secure ? 'translate-x-4' : ''].join(' ')} />
                    </span>
                  </button>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Gebruikersnaam">
                  <input className={inputCls} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" />
                </Field>
                <Field label="Wachtwoord">
                  <input className={inputCls} type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" />
                </Field>
              </div>
              <Field label="Live-URL-formaat" hint="Werkt een zender niet? Sommige providers vereisen een ander formaat.">
                <select className={inputCls} value={liveFormat} onChange={(e) => setLiveFormat(e.target.value as LiveFormatPreset)}>
                  {liveFormats.map((f) => (
                    <option key={f.id} value={f.id} className="bg-antraciet-800">
                      {f.label}
                    </option>
                  ))}
                </select>
              </Field>
              {liveFormat === 'custom' && (
                <Field label="Template" hint="Placeholders: {scheme} {host} {port} {username} {password} {id}">
                  <input className={`${inputCls} font-mono text-xs`} value={liveTemplate} onChange={(e) => setLiveTemplate(e.target.value)} />
                </Field>
              )}
            </>
          )}

          {tab === 'm3u-url' && (
            <>
              <Field label="M3U-URL" hint="Directe link naar je .m3u of .m3u8 playlist.">
                <input className={inputCls} value={m3uUrl} onChange={(e) => setM3uUrl(e.target.value)} placeholder="https://…/playlist.m3u" autoComplete="off" />
              </Field>
              <Field label="EPG-URL (optioneel)" hint="XMLTV-bron; overschrijft x-tvg-url uit de playlist.">
                <input className={inputCls} value={epgUrl} onChange={(e) => setEpgUrl(e.target.value)} placeholder="https://…/epg.xml" autoComplete="off" />
              </Field>
            </>
          )}

          {tab === 'm3u-text' && (
            <Field label="M3U-bestand" hint={fileName ? `Geladen: ${fileName}` : 'Kies een .m3u/.m3u8 van je apparaat.'}>
              <input
                type="file"
                accept=".m3u,.m3u8,audio/x-mpegurl,application/x-mpegurl,text/plain"
                onChange={onFile}
                className="block w-full text-sm text-mist-400 file:mr-3 file:rounded-lg file:border-0 file:bg-buisgroen file:px-4 file:py-2 file:text-sm file:font-semibold file:text-antraciet-900 hover:file:bg-buisgroen-400"
              />
            </Field>
          )}

          {/* TMDB-sleutel (optioneel, geldt voor alle bronnen) */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
            <Field label="TMDB-sleutel (optioneel)" hint="Verrijkt kale titels met posters, omschrijving en cast.">
              <input className={inputCls} value={tmdb} onChange={(e) => setTmdb(e.target.value)} placeholder="API-sleutel" autoComplete="off" />
            </Field>
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-6 py-4">
          <button
            onClick={onResetDemo}
            disabled={busy || currentKind === 'demo'}
            className="text-sm font-medium text-mist-400 transition-colors hover:text-mist disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-buisgroen rounded"
          >
            Terug naar demo
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-full px-4 py-2.5 text-sm font-semibold text-mist-400 transition-colors hover:text-mist outline-none focus-visible:ring-2 focus-visible:ring-buisgroen"
            >
              Annuleren
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="flex items-center gap-2 rounded-full bg-buisgroen px-6 py-2.5 text-sm font-bold text-antraciet-900 shadow-glow transition-transform hover:scale-[1.03] disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-buisgroen"
            >
              {busy && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-antraciet-900/40 border-t-antraciet-900" />
              )}
              {busy ? 'Laden…' : 'Laden'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
