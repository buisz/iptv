import { useEffect, useMemo, useState } from 'react'
import NavBar from './components/NavBar'
import HeroBanner from './components/HeroBanner'
import ContentRow from './components/ContentRow'
import DetailOverlay from './components/DetailOverlay'
import SourceModal from './components/SourceModal'
import OnboardingWizard from './components/OnboardingWizard'
import Player, { type PlayRequest } from './components/Player'
import type { MediaItem } from './types/content'
import type { Source } from './types/source'
import { useSpatialNav } from './hooks/useSpatialNav'
import { useCatalog } from './hooks/useCatalog'
import { enrichItem } from './api/tmdb'
import { loadSeriesInfo } from './api/xtream'

const ONBOARDED_KEY = 'buisz.onboarded'

function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1'
  } catch {
    return false
  }
}

function markOnboarded() {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1')
  } catch {
    /* localStorage niet beschikbaar — wizard verschijnt dan opnieuw */
  }
}

export default function App() {
  const { source, catalog, loading, error, setSource, reset, patchCatalog, configured } = useCatalog()
  const [activeKey, setActiveKey] = useState('home')
  const [selected, setSelected] = useState<MediaItem | null>(null)
  const [playing, setPlaying] = useState<PlayRequest | null>(null)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [noticesDismissed, setNoticesDismissed] = useState(false)
  // Eerste keer (geen bewaarde bron én niet eerder afgerond): toon de wizard
  // verplicht. Daarna kan de wizard opnieuw geopend worden in "rondkijk"-modus.
  const [wizardOpen, setWizardOpen] = useState(() => !configured && !isOnboarded())
  const [wizardDismissible, setWizardDismissible] = useState(false)

  function openWizard() {
    setWizardDismissible(true)
    setWizardOpen(true)
  }

  const sections = catalog.sections
  const activeSection = useMemo(
    () => sections.find((s) => s.key === activeKey) ?? sections[0],
    [sections, activeKey],
  )

  // Houd de actieve sectie geldig wanneer de catalogus (bron) verandert.
  useEffect(() => {
    if (!sections.some((s) => s.key === activeKey)) {
      setActiveKey(sections[0]?.key ?? 'home')
    }
  }, [sections, activeKey])

  useEffect(() => setNoticesDismissed(false), [catalog])

  // Back-knop (afstandsbediening → Backspace) sluit de bovenste overlay.
  useEffect(() => {
    function onBack(e: KeyboardEvent) {
      if (e.key !== 'Backspace') return
      const t = e.target as HTMLElement | null
      const editing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (editing) return
      if (playing) {
        e.preventDefault()
        setPlaying(null)
      } else if (sourceOpen) {
        e.preventDefault()
        setSourceOpen(false)
      } else if (selected) {
        e.preventDefault()
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onBack)
    return () => window.removeEventListener('keydown', onBack)
  }, [playing, sourceOpen, selected])

  // Pijltjesnavigatie staat uit zolang een overlay/wizard open is.
  useSpatialNav(selected === null && !sourceOpen && playing === null && !wizardOpen)

  function handleSelectSection(key: string) {
    setActiveKey(key)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** Opent het detail en verrijkt het item op de achtergrond (TMDB / series-info). */
  async function openItem(item: MediaItem) {
    setSelected(item)

    let enriched = item

    // Xtream: laad seizoenen/afleveringen indien nog niet aanwezig.
    if (item.ref?.kind === 'xtream-series' && !item.seasons && source.kind === 'xtream') {
      try {
        const seasons = await loadSeriesInfo(source, item.ref.id)
        enriched = { ...enriched, seasons }
      } catch {
        /* series-info optioneel — toon detail zonder afleveringen */
      }
    }

    // TMDB-verrijking (alleen met sleutel, niet voor live).
    enriched = await enrichItem(enriched)

    if (enriched !== item) {
      setSelected((cur) => (cur && cur.id === item.id ? enriched : cur))
      // Werk het item ook in de catalogus bij zodat verrijking blijft hangen.
      patchCatalog((prev) => ({
        ...prev,
        sections: prev.sections.map((sec) => ({
          ...sec,
          rows: sec.rows.map((row) => ({
            ...row,
            items: row.items.map((it) => (it.id === item.id ? enriched : it)),
          })),
        })),
      }))
    }
  }

  async function applySource(next: Source) {
    const ok = await setSource(next)
    // Sluit de modal alleen bij succes; bij een fout blijft hij open met de melding.
    if (ok) setSourceOpen(false)
  }

  // Wizard: laadt de bron en sluit de wizard alleen bij succes.
  async function wizardApply(next: Source): Promise<boolean> {
    const ok = await setSource(next)
    if (ok) {
      markOnboarded()
      setWizardOpen(false)
    }
    return ok
  }

  function wizardUseDemo() {
    reset()
    markOnboarded()
    setWizardOpen(false)
  }

  const showHero = activeKey === (sections[0]?.key ?? 'home') && Boolean(catalog.hero)
  const notices = catalog.notices ?? []

  return (
    <div className="min-h-screen">
      <NavBar
        sections={sections}
        activeKey={activeKey}
        onSelect={handleSelectSection}
        sourceLabel={catalog.sourceLabel}
        loading={loading}
        onOpenSource={() => setSourceOpen(true)}
      />

      <main>
        {showHero ? (
          <HeroBanner item={catalog.hero} onOpen={openItem} />
        ) : (
          <div className="edge-x pt-28 pb-2 sm:pt-32">
            <h1 className="text-3xl font-extrabold tracking-tight text-mist sm:text-4xl">
              {activeSection?.label}
            </h1>
            <p className="mt-1 text-sm text-mist-400">
              {catalog.sourceLabel} · blader door je {activeSection?.label.toLowerCase()}.
            </p>
          </div>
        )}

        {/* Meldingen (afgekapte rijen e.d.) */}
        {notices.length > 0 && !noticesDismissed && (
          <div className="edge-x mt-4">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-buisgroen/20 bg-buisgroen/[0.06] px-4 py-3 text-sm text-mist-400">
              <div>
                <p className="font-semibold text-mist">Let op</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                  {notices.slice(0, 4).map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setNoticesDismissed(true)}
                className="shrink-0 text-xs font-semibold text-mist-300 hover:text-mist outline-none focus-visible:ring-2 focus-visible:ring-buisgroen rounded"
              >
                Sluiten
              </button>
            </div>
          </div>
        )}

        <div
          className={[
            'relative z-10 flex flex-col',
            showHero ? '-mt-[clamp(3rem,10vh,9rem)] pt-2' : 'pt-4',
          ].join(' ')}
          style={{ gap: 'var(--row-gap)' }}
        >
          {activeSection?.rows.map((row, i) => (
            <ContentRow key={row.id} row={row} rowIndex={i} onOpen={openItem} />
          ))}
        </div>

        <footer className="edge-x mt-20 border-t border-white/[0.06] py-10 text-center text-xs text-mist-300">
          <p className="font-semibold text-mist-400">Buisz · IPTV-player</p>
          <p className="mx-auto mt-2 max-w-xl leading-relaxed">
            Buisz is een speler: je laadt je eigen legale M3U-playlist of Xtream-account.
            De app levert zelf geen streams of zenders. Actieve bron: {catalog.sourceLabel}.
          </p>
        </footer>
      </main>

      <DetailOverlay item={selected} onClose={() => setSelected(null)} onPlay={setPlaying} />

      <Player request={playing} onClose={() => setPlaying(null)} />

      {/* Demo-modus: duidelijke, vaste CTA rechtsonder om de wizard te (her)openen. */}
      {source.kind === 'demo' && !wizardOpen && (
        <button
          onClick={openWizard}
          className="fixed bottom-5 right-5 z-30 flex items-center gap-2.5 rounded-full bg-buisgroen px-5 py-3 text-sm font-bold text-antraciet-900 shadow-glow transition-transform hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-buisgroen focus-visible:ring-offset-2 focus-visible:ring-offset-antraciet-900 outline-none"
        >
          <span className="grid h-5 w-5 place-items-center rounded-full bg-antraciet-900/15">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </span>
          Stel je bron in
          <span className="rounded-full bg-antraciet-900/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            Demo
          </span>
        </button>
      )}

      {wizardOpen && (
        <OnboardingWizard
          busy={loading}
          error={error}
          onApply={wizardApply}
          onUseDemo={wizardUseDemo}
          dismissible={wizardDismissible}
          onClose={() => setWizardOpen(false)}
        />
      )}

      <SourceModal
        open={sourceOpen}
        busy={loading}
        error={error}
        currentKind={source.kind}
        onClose={() => setSourceOpen(false)}
        onApply={applySource}
        onResetDemo={() => {
          reset()
          setSourceOpen(false)
        }}
      />
    </div>
  )
}
