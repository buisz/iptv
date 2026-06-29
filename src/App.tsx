import { useMemo, useState } from 'react'
import NavBar from './components/NavBar'
import HeroBanner from './components/HeroBanner'
import ContentRow from './components/ContentRow'
import DetailOverlay from './components/DetailOverlay'
import { heroItem, sections } from './data/mockContent'
import type { MediaItem } from './types/content'
import { useSpatialNav } from './hooks/useSpatialNav'

export default function App() {
  const [activeKey, setActiveKey] = useState('home')
  const [selected, setSelected] = useState<MediaItem | null>(null)

  const activeSection = useMemo(
    () => sections.find((s) => s.key === activeKey) ?? sections[0],
    [activeKey],
  )

  // Pijltjesnavigatie staat uit zolang de detail-overlay open is.
  useSpatialNav(selected === null)

  function handleSelectSection(key: string) {
    setActiveKey(key)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const showHero = activeKey === 'home'

  return (
    <div className="min-h-screen">
      <NavBar sections={sections} activeKey={activeKey} onSelect={handleSelectSection} />

      <main>
        {showHero ? (
          <HeroBanner item={heroItem} onOpen={setSelected} />
        ) : (
          // Compacte kop voor niet-home secties.
          <div className="edge-x pt-28 pb-2 sm:pt-32">
            <h1 className="text-3xl font-extrabold tracking-tight text-mist sm:text-4xl">
              {activeSection.label}
            </h1>
            <p className="mt-1 text-sm text-mist-400">
              Blader door je {activeSection.label.toLowerCase()} — demodata in dit prototype.
            </p>
          </div>
        )}

        {/* Rijen — overlappen subtiel met de hero voor diepte. */}
        <div
          className={[
            'relative z-10 flex flex-col',
            showHero ? '-mt-[clamp(3rem,10vh,9rem)] pt-2' : 'pt-4',
          ].join(' ')}
          style={{ gap: 'var(--row-gap)' }}
        >
          {activeSection.rows.map((row, i) => (
            <ContentRow key={row.id} row={row} rowIndex={i} onOpen={setSelected} />
          ))}
        </div>

        <footer className="edge-x mt-20 border-t border-white/[0.06] py-10 text-center text-xs text-mist-300">
          <p className="font-semibold text-mist-400">Buisz · IPTV-player</p>
          <p className="mx-auto mt-2 max-w-xl leading-relaxed">
            Fase 1 — visueel prototype met demodata. Buisz is een speler: je laadt je
            eigen legale M3U-playlist of Xtream-account. De app levert zelf geen streams
            of zenders.
          </p>
        </footer>
      </main>

      <DetailOverlay item={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
