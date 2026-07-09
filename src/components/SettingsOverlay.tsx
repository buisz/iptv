import { useEffect, useState } from 'react'
import { useI18n, type Lang } from '../i18n'
import { lockScroll, unlockScroll } from '../lib/scrollLock'
import { clearFavorites } from '../api/favorites'
import { clearProgress } from '../api/progress'
import { pairBase, setPairBase } from '../api/pairing'
import { getBufferPreset, setBufferPreset, type BufferPreset } from '../api/player/buffering'

interface SettingsOverlayProps {
  open: boolean
  sourceLabel: string
  onClose: () => void
  onManageSource: () => void
  onRestartWizard: () => void
  /** Roep aan na het wissen van lijst/geschiedenis, om home te verversen. */
  onChanged: () => void
}

const LANGS: { id: Lang; label: string }[] = [
  { id: 'nl', label: 'Nederlands' },
  { id: 'en', label: 'English' },
]

const STORAGE_KEYS = [
  'buisz.source',
  'buisz.onboarded',
  'buisz.progress',
  'buisz.favorites',
  'buisz.tmdbKey',
  'buisz.lang',
  'buisz.buffer',
]

const BUFFER_PRESETS: { id: BufferPreset; labelKey: string }[] = [
  { id: 'auto', labelKey: 'settings.bufferAuto' },
  { id: 'low', labelKey: 'settings.bufferLow' },
  { id: 'smooth', labelKey: 'settings.bufferSmooth' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-mist-300">{title}</h3>
      <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">{children}</div>
    </div>
  )
}

function Row({
  label,
  hint,
  onClick,
  danger,
  right,
}: {
  label: string
  hint?: string
  onClick?: () => void
  danger?: boolean
  right?: React.ReactNode
}) {
  const content = (
    <span className="flex items-center justify-between gap-3 px-4 py-3 text-left">
      <span className="min-w-0">
        <span className={['block text-sm font-semibold', danger ? 'text-red-400' : 'text-mist'].join(' ')}>
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-mist-400">{hint}</span>}
      </span>
      {right ?? (onClick && (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-mist-300" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  )
  return onClick ? (
    <button
      onClick={onClick}
      className="block w-full border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-buisgroen outline-none"
    >
      {content}
    </button>
  ) : (
    <div className="border-b border-white/[0.06] last:border-0">{content}</div>
  )
}

export default function SettingsOverlay({
  open,
  sourceLabel,
  onClose,
  onManageSource,
  onRestartWizard,
  onChanged,
}: SettingsOverlayProps) {
  const { lang, setLang, t } = useI18n()
  const [pair, setPair] = useState(pairBase())
  const [buffer, setBuffer] = useState<BufferPreset>(() => getBufferPreset())

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    lockScroll()
    return () => {
      window.removeEventListener('keydown', onKey)
      unlockScroll()
    }
  }, [open, onClose])

  if (!open) return null

  function resetAll() {
    const ok = window.confirm(t('settings.resetAllHint'))
    if (!ok) return
    try {
      for (const k of STORAGE_KEYS) localStorage.removeItem(k)
    } catch {
      /* localStorage niet beschikbaar */
    }
    window.location.reload()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('settings.title')}
      className="fixed inset-0 z-[78] flex items-start justify-center overflow-y-auto bg-antraciet-900/80 p-4 backdrop-blur-md animate-fade-in sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative my-6 w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)] bg-antraciet-800 shadow-2xl ring-1 ring-white/10 animate-scale-in">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h2 className="text-lg font-bold text-mist">{t('settings.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="grid h-9 w-9 place-items-center rounded-full text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-mist focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Taal */}
          <Section title={t('settings.language')}>
            <div className="flex gap-2 p-3">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLang(l.id)}
                  className={[
                    'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-buisgroen',
                    lang === l.id ? 'bg-buisgroen text-antraciet-900' : 'bg-white/[0.04] text-mist-400 hover:text-mist',
                  ].join(' ')}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Buffer / afspelen */}
          <Section title={t('settings.buffer')}>
            <div className="flex gap-2 p-3">
              {BUFFER_PRESETS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setBuffer(b.id)
                    setBufferPreset(b.id)
                  }}
                  className={[
                    'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-buisgroen',
                    buffer === b.id ? 'bg-buisgroen text-antraciet-900' : 'bg-white/[0.04] text-mist-400 hover:text-mist',
                  ].join(' ')}
                >
                  {t(b.labelKey)}
                </button>
              ))}
            </div>
            <p className="border-t border-white/[0.06] px-4 py-3 text-xs leading-relaxed text-mist-400">
              {t(`settings.bufferHint.${buffer}`)}
            </p>
          </Section>

          {/* Bron */}
          <Section title={t('settings.source')}>
            <Row label={t('settings.sourceManage')} hint={sourceLabel} onClick={onManageSource} />
            <Row label={t('settings.restartWizard')} hint={t('settings.restartWizardHint')} onClick={onRestartWizard} />
          </Section>

          {/* QR-koppeling */}
          <Section title="Koppel-service (QR)">
            <label className="block px-4 py-3">
              <span className="mb-1 block text-xs text-mist-400">
                Cloudflare-Worker-URL (zie worker/README). Leeg = uit.
              </span>
              <input
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                onBlur={() => setPairBase(pair)}
                placeholder="https://buisz-pair.<jij>.workers.dev"
                className="w-full rounded-lg border border-white/10 bg-antraciet-900/60 px-3 py-2.5 text-sm text-mist placeholder:text-mist-300 outline-none focus:border-buisgroen/60 focus:ring-2 focus:ring-buisgroen/30"
                autoComplete="off"
              />
            </label>
          </Section>

          {/* Gegevens */}
          <Section title={t('settings.data')}>
            <Row
              label={t('settings.clearHistory')}
              onClick={() => {
                clearProgress()
                onChanged()
              }}
            />
            <Row
              label={t('settings.clearFavorites')}
              onClick={() => {
                clearFavorites()
                onChanged()
              }}
            />
            <Row label={t('settings.resetAll')} hint={t('settings.resetAllHint')} danger onClick={resetAll} />
          </Section>

          <p className="px-1 text-xs leading-relaxed text-mist-300">{t('settings.about')}</p>
        </div>
      </div>
    </div>
  )
}
