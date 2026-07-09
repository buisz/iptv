import { useEffect, useState } from 'react'

/**
 * Lichte lijst-/grid-virtualisatie zonder externe library (ES5-vriendelijk, werkt
 * op oude TV's via de legacy-build).
 *
 * Waarom: overlays zoals de Gids renderen anders alle kanalen tegelijk (bijv. 3282
 * rijen + evenzoveel IntersectionObservers) → traag opstarten en veel geheugen.
 * We renderen alleen de rijen die (met wat overscan) zichtbaar zijn en houden de
 * scrollhoogte kloppend met een boven- en onder-spacer.
 *
 * Grid: geef `columns` > 1 en de items worden per rij gegroepeerd.
 */
export interface VirtualWindow {
  /** Eerste zichtbare item-index (inclusief). */
  start: number
  /** Laatste zichtbare item-index (exclusief). */
  end: number
  /** Totale hoogte van alle rijen (voor de scrollbaan). */
  totalHeight: number
  /** Verticale offset van het eerste gerenderde item. */
  offsetTop: number
}

interface Options {
  count: number
  rowHeight: number
  columns?: number
  overscan?: number
}

export function useVirtualRows(
  scrollRef: React.RefObject<HTMLElement>,
  { count, rowHeight, columns = 1, overscan = 4 }: Options,
): VirtualWindow {
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0 })

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let raf = 0
    const measure = () => {
      raf = 0
      setViewport({ scrollTop: el.scrollTop, height: el.clientHeight })
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(measure)
    }

    measure()
    el.addEventListener('scroll', onScroll, { passive: true })

    // Herbereken bij formaatwijziging (rotatie, venster, kolomwissel).
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      ro.observe(el)
    } else {
      window.addEventListener('resize', measure)
    }

    return () => {
      if (raf) cancelAnimationFrame(raf)
      el.removeEventListener('scroll', onScroll)
      if (ro) ro.disconnect()
      else window.removeEventListener('resize', measure)
    }
  }, [scrollRef, count, rowHeight, columns])

  const rows = Math.ceil(count / columns)
  const totalHeight = rows * rowHeight

  const firstRow = Math.max(0, Math.floor(viewport.scrollTop / rowHeight) - overscan)
  const visibleRows = Math.ceil(viewport.height / rowHeight) + overscan * 2
  const lastRow = Math.min(rows, firstRow + visibleRows)

  const start = firstRow * columns
  const end = Math.min(count, lastRow * columns)
  const offsetTop = firstRow * rowHeight

  return { start, end, totalHeight, offsetTop }
}
