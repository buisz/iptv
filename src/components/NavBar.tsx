import { useEffect, useState } from 'react'
import type { CatalogSection } from '../types/content'

interface NavBarProps {
  sections: CatalogSection[]
  activeKey: string
  onSelect: (key: string) => void
  sourceLabel: string
  loading: boolean
  onOpenSource: () => void
  onSearch: () => void
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-antraciet-700 ring-1 ring-buisgroen/30">
        <svg viewBox="0 0 40 40" className="h-6 w-6" aria-hidden="true">
          <rect x="6" y="9" width="28" height="20" rx="4" fill="none" stroke="#34e3a8" strokeWidth="2.5" />
          <path d="M16 16.5 25 20 16 23.5 Z" fill="#34e3a8" />
          <rect x="13" y="32" width="14" height="2.5" rx="1.25" fill="#14706a" />
        </svg>
      </span>
      <span className="text-lg font-extrabold tracking-tight">
        Buisz<span className="text-buisgroen">.</span>
      </span>
    </div>
  )
}

export default function NavBar({
  sections,
  activeKey,
  onSelect,
  sourceLabel,
  loading,
  onOpenSource,
  onSearch,
}: NavBarProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-40 transition-colors duration-300',
        scrolled
          ? 'bg-antraciet-900/85 backdrop-blur-xl border-b border-white/[0.06]'
          : 'bg-gradient-to-b from-antraciet-900/90 to-transparent',
      ].join(' ')}
    >
      <nav className="edge-x flex h-16 items-center gap-6 md:h-[4.5rem]">
        <Logo />

        <ul className="ml-2 hidden items-center gap-1 md:flex">
          {sections.map((s) => {
            const active = s.key === activeKey
            return (
              <li key={s.key}>
                <button
                  onClick={() => onSelect(s.key)}
                  aria-current={active ? 'page' : undefined}
                  data-nav-top
                  className={[
                    'relative rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-buisgroen focus-visible:ring-offset-2 focus-visible:ring-offset-antraciet-900 outline-none',
                    active ? 'text-mist' : 'text-mist-400 hover:text-mist',
                  ].join(' ')}
                >
                  {s.label}
                  {active && (
                    <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-buisgroen shadow-[0_0_12px_rgba(52,227,168,0.8)]" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          {/* Bronkiezer — opent het scherm om M3U / Xtream te laden. */}
          <button
            onClick={onOpenSource}
            className="flex max-w-[14rem] items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-2 text-sm font-medium text-mist-400 transition-colors hover:text-mist hover:border-buisgroen/40 focus-visible:ring-2 focus-visible:ring-buisgroen outline-none sm:px-3.5"
            title="Bron toevoegen of wisselen"
          >
            <span
              className={[
                'h-2 w-2 shrink-0 rounded-full bg-buisgroen',
                loading ? 'animate-pulse-soft' : '',
              ].join(' ')}
            />
            <span className="hidden truncate sm:block">{sourceLabel}</span>
          </button>
          <button
            onClick={onSearch}
            aria-label="Zoeken"
            className="grid h-10 w-10 place-items-center rounded-full text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-mist focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </button>
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-diepteal-400 to-diepteal-600 text-sm font-bold text-antraciet-900">
            R
          </span>
        </div>
      </nav>

      {/* Mobiele sectie-tabs */}
      <ul className="edge-x flex items-center gap-1 overflow-x-auto pb-2 md:hidden row-scroll">
        {sections.map((s) => {
          const active = s.key === activeKey
          return (
            <li key={s.key} className="shrink-0">
              <button
                onClick={() => onSelect(s.key)}
                className={[
                  'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors outline-none',
                  active ? 'bg-buisgroen text-antraciet-900' : 'text-mist-400',
                ].join(' ')}
              >
                {s.label}
              </button>
            </li>
          )
        })}
      </ul>
    </header>
  )
}
