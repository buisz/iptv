import { useEffect, useMemo, useState } from 'react'
import type { ContentRowData, MediaItem } from '../types/content'
import type { Source } from '../types/source'
import GuideGrid from './GuideGrid'
import LiveTile from './LiveTile'
import { getLiveView, setLiveView, type LiveView } from '../api/liveView'
import { useT } from '../i18n'

/**
 * Live TV-navigatie: categorielijst (mappen) + zender-grid, i.p.v. tientallen
 * gestapelde rijen. Kies een map → zie die zenders in een dicht grid. Favorieten
 * staan bovenaan en zijn standaard geselecteerd.
 *
 * Cross-platform:
 * - Desktop/tablet/TV: verticale maprail links + grid rechts (D-pad: pijlen door
 *   het grid via de globale spatial-nav; rail is met Tab bereikbaar).
 * - Telefoon: horizontale chip-balk met mappen bovenaan + grid eronder.
 */

interface LiveBrowserProps {
  categories: ContentRowData[]
  favorites: MediaItem[]
  source: Source
  onOpen: (item: MediaItem) => void
  onPlay: (item: MediaItem) => void
  onFavoriteChange?: () => void
}

const FAV_ID = '__favorites'

function colsFor(width: number): number {
  if (width >= 1280) return 5
  if (width >= 1024) return 4
  if (width >= 640) return 3
  return 2
}

/** Aantal grid-kolommen (voor de spatial-nav row/col), reageert op resize. */
function useColumns(): number {
  const [cols, setCols] = useState(() =>
    typeof window === 'undefined' ? 4 : colsFor(window.innerWidth),
  )
  useEffect(() => {
    const on = () => setCols(colsFor(window.innerWidth))
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return cols
}

export default function LiveBrowser({
  categories,
  favorites,
  source,
  onOpen,
  onPlay,
  onFavoriteChange,
}: LiveBrowserProps) {
  const t = useT()
  const cols = useColumns()
  const [view, setView] = useState<LiveView>(getLiveView)
  // Volg wijzigingen die elders zijn gemaakt (bijv. de voorkeur in Instellingen).
  useEffect(() => {
    const sync = () => setView(getLiveView())
    window.addEventListener('buisz:liveView', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('buisz:liveView', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  function chooseView(v: LiveView) {
    setView(v)
    setLiveView(v)
  }

  const folders = useMemo(() => {
    const list = [...categories]
    if (favorites.length) {
      list.unshift({ id: FAV_ID, title: t('row.favChannels'), items: favorites })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, favorites])

  const [selectedId, setSelectedId] = useState<string>(() => folders[0]?.id ?? '')
  // Houd de selectie geldig als de mappen/favorieten wijzigen.
  useEffect(() => {
    if (!folders.some((f) => f.id === selectedId)) setSelectedId(folders[0]?.id ?? '')
  }, [folders, selectedId])

  const selected = folders.find((f) => f.id === selectedId) ?? folders[0]

  if (!folders.length) {
    return <p className="edge-x text-sm text-mist-400">Geen kanalen gevonden.</p>
  }

  return (
    <div className="edge-x flex flex-col gap-4 sm:flex-row sm:gap-6">
      {/* Maprail (sm+ verticaal) / chip-balk (mobiel horizontaal) */}
      <nav
        aria-label="Categorieën"
        className="row-scroll -mx-[var(--edge)] flex shrink-0 gap-2 overflow-x-auto px-[var(--edge)] sm:mx-0 sm:w-56 sm:flex-col sm:overflow-x-visible sm:px-0 lg:w-64"
      >
        {folders.map((f) => {
          const active = f.id === selectedId
          return (
            <button
              key={f.id}
              onClick={() => setSelectedId(f.id)}
              aria-current={active ? 'true' : undefined}
              className={[
                'flex shrink-0 items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-buisgroen sm:shrink',
                active
                  ? 'bg-buisgroen text-antraciet-900'
                  : 'bg-white/[0.04] text-mist-300 hover:bg-white/[0.08] hover:text-mist',
              ].join(' ')}
            >
              <span className="flex items-center gap-2 truncate">
                {f.id === FAV_ID && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
                    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
                  </svg>
                )}
                <span className="truncate">{f.title}</span>
              </span>
              <span
                className={[
                  'shrink-0 rounded-full px-1.5 text-[11px] font-bold',
                  active ? 'bg-antraciet-900/20 text-antraciet-900' : 'text-mist-400',
                ].join(' ')}
              >
                {f.items.length}
              </span>
            </button>
          )
        })}
      </nav>

      {/* Inhoud van de gekozen map: gids (tijdlijn) of grid */}
      <div className="min-w-0 flex-1">
        {/* Weergave-schakelaar */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="truncate text-base font-bold text-mist">{selected.title}</h2>
          <div className="flex shrink-0 gap-1 rounded-full bg-white/[0.05] p-1">
            {(['guide', 'grid'] as const).map((v) => (
              <button
                key={v}
                onClick={() => chooseView(v)}
                aria-pressed={view === v}
                className={[
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-buisgroen',
                  view === v ? 'bg-buisgroen text-antraciet-900' : 'text-mist-400 hover:text-mist',
                ].join(' ')}
              >
                {v === 'guide' ? t('live.guide') : t('live.grid')}
              </button>
            ))}
          </div>
        </div>

        {view === 'guide' ? (
          <GuideGrid
            key={selected.id}
            channels={selected.items}
            source={source}
            onPlay={onPlay}
            onFavoriteChange={onFavoriteChange}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {selected.items.map((item, i) => (
              <LiveTile
                key={`${selected.id}-${item.id}-${i}`}
                item={item}
                source={source}
                row={Math.floor(i / cols)}
                col={i % cols}
                fill
                onOpen={onOpen}
                onFavoriteChange={onFavoriteChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
