import { useEffect, useState } from 'react'
import type { Source, LiveFormatPreset } from '../types/source'
import { detectSource } from '../api/detect'
import { getTmdbKey, setTmdbKey } from '../api/tmdb'

interface OnboardingWizardProps {
  busy: boolean
  error: string | null
  /** Laadt de bron; true = gelukt (wizard sluit dan), false = fout (blijf staan). */
  onApply: (source: Source) => Promise<boolean>
  /** Sla over en gebruik de demo-bron (alleen bij de eerste keer). */
  onUseDemo: () => void
  /** Of de wizard gesloten mag worden (true zodra er al iets te zien is). */
  dismissible?: boolean
  /** Sluiten zonder van bron te wisselen (alleen relevant als dismissible). */
  onClose?: () => void
}

type Step = 'welcome' | 'choose' | 'details'
type Kind = 'xtream' | 'm3u-url' | 'm3u-text'

const inputCls =
  'w-full rounded-lg border border-white/10 bg-antraciet-900/60 px-3 py-2.5 text-sm text-mist placeholder:text-mist-300 outline-none transition-colors focus:border-buisgroen/60 focus:ring-2 focus:ring-buisgroen/30'

const liveFormats: { id: LiveFormatPreset; label: string }[] = [
  { id: 'ts', label: '.ts (standaard)' },
  { id: 'm3u8', label: '.m3u8 (HLS)' },
  { id: 'mpegts-noext', label: 'zonder /live/ en extensie' },
  { id: 'custom', label: 'eigen template' },
]

function Logo() {
  return (
    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-antraciet-700 ring-1 ring-buisgroen/30">
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden="true">
        <rect x="6" y="9" width="28" height="20" rx="4" fill="none" stroke="#34e3a8" strokeWidth="2.5" />
        <path d="M16 16.5 25 20 16 23.5 Z" fill="#34e3a8" />
        <rect x="13" y="32" width="14" height="2.5" rx="1.25" fill="#14706a" />
      </svg>
    </span>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-mist-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-mist-300">{hint}</span>}
    </label>
  )
}

export default function OnboardingWizard({
  busy,
  error,
  onApply,
  onUseDemo,
  dismissible = false,
  onClose,
}: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>('welcome')
  const [kind, setKind] = useState<Kind>('xtream')

  // Sluiten met Escape wanneer toegestaan (rondkijk-modus).
  useEffect(() => {
    if (!dismissible || !onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dismissible, onClose, busy])

  // Snelle plak-detectie
  const [paste, setPaste] = useState('')
  const [detectNote, setDetectNote] = useState<string | null>(null)

  // Xtream
  const [host, setHost] = useState('')
  const [xport, setXport] = useState('')
  const [secure, setSecure] = useState(false)
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [liveFormat, setLiveFormat] = useState<LiveFormatPreset>('ts')

  // M3U
  const [m3uUrl, setM3uUrl] = useState('')
  const [fileText, setFileText] = useState('')
  const [fileName, setFileName] = useState('')

  // TMDB
  const [tmdb, setTmdb] = useState(getTmdbKey() ?? '')

  function prefillFrom(source: Source) {
    if (source.kind === 'xtream') {
      setKind('xtream')
      setHost(source.host)
      setXport(source.port ? String(source.port) : '')
      setSecure(Boolean(source.secure))
      setUser(source.username)
      setPass(source.password)
    } else if (source.kind === 'm3u-url') {
      setKind('m3u-url')
      setM3uUrl(source.url)
    }
  }

  function onDetect() {
    const result = detectSource(paste)
    if (!result) {
      setDetectNote('Geen geldige link herkend. Plak een volledige http(s)-URL of kies handmatig.')
      return
    }
    prefillFrom(result.source)
    setDetectNote(result.note)
    setStep('details')
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setFileText(await file.text())
  }

  function buildSource(): Source | null {
    if (kind === 'xtream') {
      if (!host.trim() || !user.trim() || !pass) return null
      return {
        kind: 'xtream',
        host: host.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
        port: xport ? Number(xport) : undefined,
        secure,
        username: user.trim(),
        password: pass,
        liveFormat,
      }
    }
    if (kind === 'm3u-url') {
      if (!m3uUrl.trim()) return null
      return { kind: 'm3u-url', url: m3uUrl.trim() }
    }
    if (!fileText.trim()) return null
    return { kind: 'm3u-text', text: fileText, name: fileName || undefined }
  }

  async function submit() {
    const source = buildSource()
    if (!source) return
    setTmdbKey(tmdb.trim() || null)
    await onApply(source) // bij succes verbergt de parent de wizard
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-antraciet-900 p-4 animate-fade-in sm:p-8">
      {/* Sfeergloed */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 520px at 80% -10%, rgba(20,112,106,0.4), transparent 60%), radial-gradient(700px 400px at 5% 10%, rgba(52,227,168,0.12), transparent 55%)',
        }}
      />

      <div className="relative w-full max-w-lg rounded-[var(--radius-lg)] border border-white/10 bg-antraciet-800/80 p-6 shadow-2xl backdrop-blur-xl animate-scale-in sm:p-8">
        {dismissible && onClose && (
          <button
            onClick={onClose}
            aria-label="Wizard sluiten"
            className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-mist focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {/* Stap-indicator */}
        <div className="mb-6 flex items-center gap-2">
          {(['welcome', 'choose', 'details'] as Step[]).map((s, i) => {
            const active = ['welcome', 'choose', 'details'].indexOf(step) >= i
            return (
              <span
                key={s}
                className={[
                  'h-1.5 flex-1 rounded-full transition-colors',
                  active ? 'bg-buisgroen' : 'bg-white/10',
                ].join(' ')}
              />
            )
          })}
        </div>

        {step === 'welcome' && (
          <div className="text-center">
            <div className="mb-5 flex justify-center">
              <Logo />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-mist sm:text-3xl">
              Welkom bij Buisz<span className="text-buisgroen">.</span>
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-mist-400">
              Een Netflix-stijl speler voor je <strong className="text-mist">eigen</strong> M3U-playlist
              of Xtream-account. Buisz levert zelf geen zenders — je laadt je eigen legale bron.
            </p>
            <div className="mt-7 flex flex-col gap-2.5">
              <button
                onClick={() => setStep('choose')}
                className="rounded-full bg-buisgroen px-6 py-3 text-base font-bold text-antraciet-900 shadow-glow transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
              >
                Bron toevoegen
              </button>
              <button
                onClick={dismissible && onClose ? onClose : onUseDemo}
                className="rounded-full px-6 py-2.5 text-sm font-semibold text-mist-400 transition-colors hover:text-mist focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
              >
                {dismissible ? 'Verder rondkijken' : 'Eerst de demo bekijken'}
              </button>
            </div>
          </div>
        )}

        {step === 'choose' && (
          <div>
            <h2 className="text-xl font-bold text-mist">Hoe wil je laden?</h2>
            <p className="mt-1 text-sm text-mist-400">Plak je link en we detecteren het type — of kies handmatig.</p>

            {/* Snelle plak-detectie */}
            <div className="mt-5">
              <Field label="Plak je provider-link" hint="Xtream- of M3U-link; we herkennen het type automatisch.">
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    value={paste}
                    onChange={(e) => setPaste(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onDetect()}
                    placeholder="http://voorbeeld.tv:8080/get.php?username=…"
                    autoComplete="off"
                  />
                  <button
                    onClick={onDetect}
                    disabled={!paste.trim()}
                    className="shrink-0 rounded-lg bg-buisgroen px-4 text-sm font-bold text-antraciet-900 transition-transform hover:scale-[1.03] disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
                  >
                    Detecteer
                  </button>
                </div>
              </Field>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs text-mist-300">
              <span className="h-px flex-1 bg-white/10" /> of kies handmatig <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid gap-2.5">
              {([
                { id: 'xtream', title: 'Xtream-account', desc: 'Host, gebruikersnaam en wachtwoord' },
                { id: 'm3u-url', title: 'M3U-URL', desc: 'Directe link naar een .m3u/.m3u8' },
                { id: 'm3u-text', title: 'M3U-bestand', desc: 'Upload vanaf je apparaat' },
              ] as { id: Kind; title: string; desc: string }[]).map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setKind(c.id)
                    setDetectNote(null)
                    setStep('details')
                  }}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-buisgroen/40 hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
                >
                  <span>
                    <span className="block text-sm font-semibold text-mist">{c.title}</span>
                    <span className="block text-xs text-mist-400">{c.desc}</span>
                  </span>
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-buisgroen" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep('welcome')}
              className="mt-5 text-sm font-medium text-mist-400 transition-colors hover:text-mist outline-none focus-visible:ring-2 focus-visible:ring-buisgroen rounded"
            >
              ← Terug
            </button>
          </div>
        )}

        {step === 'details' && (
          <div>
            <h2 className="text-xl font-bold text-mist">
              {kind === 'xtream' ? 'Xtream-gegevens' : kind === 'm3u-url' ? 'M3U-URL' : 'M3U-bestand'}
            </h2>
            {detectNote && (
              <p className="mt-2 rounded-lg border border-buisgroen/20 bg-buisgroen/[0.06] px-3 py-2 text-xs text-mist-400">
                {detectNote}
              </p>
            )}

            <div className="mt-4 space-y-4">
              {kind === 'xtream' && (
                <>
                  <Field label="Host" hint="Zonder http:// — bijv. voorbeeld.tv">
                    <input className={inputCls} value={host} onChange={(e) => setHost(e.target.value)} placeholder="voorbeeld.tv" autoComplete="off" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Poort"><input className={inputCls} value={xport} onChange={(e) => setXport(e.target.value)} placeholder="8080" inputMode="numeric" /></Field>
                    <Field label="https">
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
                    <Field label="Gebruikersnaam"><input className={inputCls} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" /></Field>
                    <Field label="Wachtwoord"><input className={inputCls} type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" /></Field>
                  </div>
                  <Field label="Live-URL-formaat" hint="Werkt een zender niet? Probeer een ander formaat.">
                    <select className={inputCls} value={liveFormat} onChange={(e) => setLiveFormat(e.target.value as LiveFormatPreset)}>
                      {liveFormats.map((f) => (
                        <option key={f.id} value={f.id} className="bg-antraciet-800">{f.label}</option>
                      ))}
                    </select>
                  </Field>
                </>
              )}

              {kind === 'm3u-url' && (
                <Field label="M3U-URL" hint="Directe link naar je .m3u of .m3u8 playlist.">
                  <input className={inputCls} value={m3uUrl} onChange={(e) => setM3uUrl(e.target.value)} placeholder="https://…/playlist.m3u" autoComplete="off" />
                </Field>
              )}

              {kind === 'm3u-text' && (
                <Field label="M3U-bestand" hint={fileName ? `Geladen: ${fileName}` : 'Kies een .m3u/.m3u8 van je apparaat.'}>
                  <input
                    type="file"
                    accept=".m3u,.m3u8,audio/x-mpegurl,application/x-mpegurl,text/plain"
                    onChange={onFile}
                    className="block w-full text-sm text-mist-400 file:mr-3 file:rounded-lg file:border-0 file:bg-buisgroen file:px-4 file:py-2 file:text-sm file:font-semibold file:text-antraciet-900 hover:file:bg-buisgroen-400"
                  />
                </Field>
              )}

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                <Field label="TMDB-sleutel (optioneel)" hint="Verrijkt kale titels met posters, omschrijving en cast.">
                  <input className={inputCls} value={tmdb} onChange={(e) => setTmdb(e.target.value)} placeholder="API-sleutel" autoComplete="off" />
                </Field>
              </div>

              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">{error}</p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={() => setStep('choose')}
                disabled={busy}
                className="text-sm font-medium text-mist-400 transition-colors hover:text-mist disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-buisgroen rounded"
              >
                ← Terug
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="flex items-center gap-2 rounded-full bg-buisgroen px-7 py-3 text-base font-bold text-antraciet-900 shadow-glow transition-transform hover:scale-[1.03] disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-buisgroen"
              >
                {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-antraciet-900/40 border-t-antraciet-900" />}
                {busy ? 'Laden…' : 'Laden & starten'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
