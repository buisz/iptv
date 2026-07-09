import { useEffect, useState } from 'react'
import { useI18n, type Lang } from '../i18n'
import { lockScroll, unlockScroll } from '../lib/scrollLock'
import { clearFavorites } from '../api/favorites'
import { clearProgress } from '../api/progress'
import { clearHistory } from '../api/history'
import { pairBase, setPairBase } from '../api/pairing'
import { getBufferPreset, setBufferPreset, type BufferPreset } from '../api/player/buffering'
import { getLiveView, setLiveView, type LiveView } from '../api/liveView'
import { nativeVideoAvailable } from '../api/player/nativeVideo'
import { describeSource } from '../types/source'
import type { SavedSource } from '../api/sources'

interface SettingsOverlayProps {
  open: boolean
  sources: SavedSource[]
  activeId: string | null
  merged: boolean
  onAddSource: () => void
  onEditSource: (id: string) => void
  onSwitchSource: (id: string) => void
  onRemoveSource: (id: string) => void
  onSetMerge: (on: boolean) => void
  onClose: () => void
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
  'buisz.sources',
  'buisz.activeSource',
  'buisz.mergeSources',
  'buisz.onboarded',
  'buisz.progress',
  'buisz.history',
  'buisz.favorites',
  'buisz.tmdbKey',
  'buisz.lang',
  'buisz.buffer',
  'buisz.liveView',
  'buisz.epgCache',
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
  sources,
  activeId,
  merged,
  onAddSource,
  onEditSource,
  onSwitchSource,
  onRemoveSource,
  onSetMerge,
  onClose,
  onRestartWizard,
  onChanged,
}: SettingsOverlayProps) {
  const { lang, setLang, t } = useI18n()
  const [pair, setPair] = useState(pairBase())
  const [buffer, setBuffer] = useState<BufferPreset>(() => getBufferPreset())
  const [liveView, setLiveViewState] = useState<LiveView>(() => getLiveView())

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
            {nativeVideoAvailable() && (
              <p className="border-t border-white/[0.06] px-4 py-3 text-xs leading-relaxed text-mist-300">
                {t('settings.bufferNativeNote')}
              </p>
            )}
          </Section>

          {/* Live TV-weergave */}
          <Section title={t('settings.liveView')}>
            <div className="flex gap-2 p-3">
              {(['guide', 'grid'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setLiveViewState(v)
                    setLiveView(v)
                  }}
                  className={[
                    'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-buisgroen',
                    liveView === v ? 'bg-buisgroen text-antraciet-900' : 'bg-white/[0.04] text-mist-400 hover:text-mist',
                  ].join(' ')}
                >
                  {v === 'guide' ? t('live.guide') : t('live.grid')}
                </button>
              ))}
            </div>
            <p className="border-t border-white/[0.06] px-4 py-3 text-xs leading-relaxed text-mist-400">
              {t('settings.liveViewHint')}
            </p>
          </Section>

          {/* Bronnen */}
          <Section title={t('settings.sources')}>
            {sources.length === 0 ? (
              <p className="px-4 py-3 text-xs text-mist-400">{t('settings.noSources')}</p>
            ) : (
              sources.map((s) => {
                const active = s.id === activeId
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 border-b border-white/[0.04] px-4 py-3 last:border-b-0"
                  >
                    <button
                      onClick={() => !merged && onSwitchSource(s.id)}
                      disabled={merged}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-buisgroen rounded disabled:cursor-default"
                    >
                      <span
                        className={[
                          'grid h-4 w-4 shrink-0 place-items-center rounded-full border',
                          active && !merged ? 'border-buisgroen' : 'border-white/20',
                        ].join(' ')}
                      >
                        {active && !merged && <span className="h-2 w-2 rounded-full bg-buisgroen" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-mist">{s.name}</span>
                        <span className="block truncate text-xs text-mist-400">{describeSource(s.source)}</span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => onEditSource(s.id)}
                        aria-label={t('settings.sourceEdit')}
                        className="grid h-8 w-8 place-items-center rounded-full text-mist-300 transition-colors hover:bg-white/[0.06] hover:text-mist focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(t('settings.sourceRemoveConfirm', { name: s.name }))) onRemoveSource(s.id)
                        }}
                        aria-label={t('settings.sourceRemove')}
                        className="grid h-8 w-8 place-items-center rounded-full text-mist-300 transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })
            )}

            {/* Samenvoegen (alleen zinvol bij meerdere bronnen). */}
            {sources.length > 1 && (
              <button
                onClick={() => onSetMerge(!merged)}
                className="flex w-full items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-buisgroen"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-mist">{t('settings.mergeSources')}</span>
                  <span className="mt-0.5 block text-xs text-mist-400">{t('settings.mergeSourcesHint')}</span>
                </span>
                <span className={['h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors', merged ? 'bg-buisgroen' : 'bg-white/15'].join(' ')}>
                  <span className={['block h-4 w-4 rounded-full bg-antraciet-900 transition-transform', merged ? 'translate-x-4' : ''].join(' ')} />
                </span>
              </button>
            )}

            <Row label={t('settings.sourceAdd')} onClick={onAddSource} />
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
                clearHistory()
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
