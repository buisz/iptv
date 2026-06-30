import type { MediaItem } from '../types/content'
import { playability, playabilityReason, useDeviceProfile, type Playability } from '../api/capabilities'

/**
 * Klein waarschuwingsicoon dat aangeeft of een stream op dít apparaat afspeelt.
 *
 * Bewust terughoudend: alleen zichtbaar bij `no` (rood) of `maybe` (amber). Bij
 * `ok`/`unknown` tonen we niets — geen ruis, geen vals alarm. Voor live/M3U is de
 * codec een naam-heuristiek, dus we waarschuwen daar pas écht hard (rood) als de
 * codec uit betrouwbare metadata komt.
 */

function resolve(item: MediaItem, p: Playability): Playability {
  // Naam-heuristiek mag niet tot een hard "kan niet" leiden: degradeer `no` → `maybe`
  // tenzij de hint uit echte metadata komt.
  if (p === 'no' && item.quality?.from !== 'meta') return 'maybe'
  return p
}

interface Props {
  item: MediaItem
  /** `badge` = compacte pill voor op een poster; `inline` = tekstregel voor detail. */
  variant?: 'badge' | 'inline'
}

export default function PlayabilityBadge({ item, variant = 'badge' }: Props) {
  const profile = useDeviceProfile()
  const raw = playability(item.quality, profile)
  const state = resolve(item, raw)

  if (variant === 'inline') {
    if (state === 'unknown') return null
    const tone =
      state === 'no'
        ? 'text-red-300'
        : state === 'maybe'
          ? 'text-amber-300'
          : 'text-buisgroen'
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${tone}`}>
        <Icon state={state} className="h-3.5 w-3.5" />
        {playabilityReason(state, item.quality)}
      </span>
    )
  }

  // badge: alleen tonen bij waarschuwing.
  if (state !== 'no' && state !== 'maybe') return null
  const cls =
    state === 'no'
      ? 'bg-red-600/90 text-white'
      : 'bg-amber-500/90 text-antraciet-900'
  return (
    <span
      className={`grid h-6 w-6 place-items-center rounded-md ${cls} backdrop-blur-sm shadow`}
      title={playabilityReason(state, item.quality)}
      aria-label={playabilityReason(state, item.quality)}
    >
      <Icon state={state} className="h-3.5 w-3.5" />
    </span>
  )
}

function Icon({ state, className }: { state: Playability; className?: string }) {
  if (state === 'no') {
    // Doorgestreepte cirkel.
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M5.6 5.6l12.8 12.8" />
      </svg>
    )
  }
  // Waarschuwingsdriehoek (maybe / overig).
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 3.2l9.5 16.4H2.5L12 3.2z" opacity="0.18" />
      <path
        d="M12 2.5L22.3 20.3a1 1 0 0 1-.87 1.5H2.57a1 1 0 0 1-.87-1.5L12 2.5zm0 5.3a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0v-5a1 1 0 0 0-1-1zm0 9.4a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3z"
        fill="currentColor"
      />
    </svg>
  )
}
