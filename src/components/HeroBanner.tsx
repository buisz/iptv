import type { MediaItem } from '../types/content'
import { useT } from '../i18n'

interface HeroBannerProps {
  item: MediaItem
  onOpen: (item: MediaItem) => void
}

function Meta({ item }: { item: MediaItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-mist-400">
      {item.score != null && (
        <span className="flex items-center gap-1.5 font-semibold text-buisgroen">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="m12 17.3-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2l2.9 6.6 7.1.6-5.4 4.8 1.6 7z" />
          </svg>
          {item.score.toFixed(1)}
        </span>
      )}
      {item.year && <span>{item.year}</span>}
      {item.rating && (
        <span className="rounded border border-white/20 px-1.5 py-0.5 text-xs">{item.rating}+</span>
      )}
      {item.genres.slice(0, 3).map((g) => (
        <span key={g} className="text-mist-400">
          {g}
        </span>
      ))}
    </div>
  )
}

export default function HeroBanner({ item, onOpen }: HeroBannerProps) {
  const t = useT()
  return (
    <section className="relative h-[68vh] min-h-[480px] w-full">
      {/* Achtergrondbeeld */}
      <div className="absolute inset-0">
        {item.backdrop ? (
          <img src={item.backdrop} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-diepteal-600/50 via-antraciet-800 to-antraciet-900" />
        )}
        {/* Scrims: links voor tekst, onder voor overgang naar de rijen. */}
        <div className="absolute inset-0 bg-gradient-to-r from-antraciet-900 via-antraciet-900/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-antraciet-900 via-antraciet-900/30 to-transparent" />
      </div>

      {/* Inhoud */}
      <div className="edge-x relative flex h-full max-w-2xl flex-col justify-end pb-[clamp(2rem,9vh,7rem)]">
        <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-buisgroen/30 bg-buisgroen/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-buisgroen animate-fade-in">
          <span className="h-1.5 w-1.5 rounded-full bg-buisgroen" />
          {t('hero.featured')}
        </span>

        <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-mist drop-shadow-sm animate-rise-in sm:text-6xl md:text-7xl">
          {item.title}
        </h1>

        {item.tagline && (
          <p className="mt-3 text-base font-medium text-buisgroen-400 animate-rise-in sm:text-lg">
            {item.tagline}
          </p>
        )}

        <div className="mt-4 animate-rise-in">
          <Meta item={item} />
        </div>

        <p className="mt-4 max-w-xl text-balance text-sm leading-relaxed text-mist-400 animate-rise-in sm:text-base">
          {item.synopsis}
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3 animate-rise-in">
          <button
            onClick={() => onOpen(item)}
            className="flex items-center gap-2.5 rounded-full bg-buisgroen px-7 py-3 text-base font-bold text-antraciet-900 shadow-glow transition-transform hover:scale-[1.03] focus-visible:scale-[1.03] focus-visible:ring-2 focus-visible:ring-buisgroen focus-visible:ring-offset-2 focus-visible:ring-offset-antraciet-900 outline-none"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
            {t('hero.play')}
          </button>
          <button
            onClick={() => onOpen(item)}
            className="flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.07] px-7 py-3 text-base font-semibold text-mist backdrop-blur-sm transition-colors hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-buisgroen focus-visible:ring-offset-2 focus-visible:ring-offset-antraciet-900 outline-none"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
            </svg>
            {t('hero.moreInfo')}
          </button>
        </div>
      </div>
    </section>
  )
}
