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

/**
 * Variant voor een lijst/grid die met de PAGINA meescrollt (geen eigen scroll-
 * container), bijv. het Live-grid. Gebruikt window-scroll + de positie van de
 * container in de viewport. `rowHeight` mag 0 zijn zolang nog niet gemeten is
 * (dan renderen we niets extra's).
 */
export function useWindowVirtualRows(
  containerRef: React.RefObject<HTMLElement>,
  { count, rowHeight, columns = 1, overscan = 4 }: Options,
): VirtualWindow {
  // `tick` dwingt herberekening af bij scroll/resize; de meting zelf gebeurt hieronder.
  const [, setTick] = useState(0)

  useEffect(() => {
    let raf = 0
    const onChange = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        setTick((n) => (n + 1) & 0xffff)
      })
    }
    window.addEventListener('scroll', onChange, { passive: true })
    window.addEventListener('resize', onChange)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onChange)
      window.removeEventListener('resize', onChange)
    }
  }, [])

  const rows = Math.ceil(count / Math.max(1, columns))
  const totalHeight = rows * rowHeight

  let firstRow = 0
  // Nog niet gemeten (rowHeight 0): render slechts een handvol rijen i.p.v. alles,
  // zodat de eerste render niet alsnog duizenden tegels bouwt.
  let lastRow = rowHeight > 0 ? rows : Math.min(rows, overscan + 4)
  const el = containerRef.current
  if (el && rowHeight > 0 && typeof window !== 'undefined') {
    const rect = el.getBoundingClientRect()
    const topWithin = Math.max(0, -rect.top) // hoeveel van de container al voorbij de bovenrand is
    firstRow = Math.max(0, Math.floor(topWithin / rowHeight) - overscan)
    const visibleRows = Math.ceil(window.innerHeight / rowHeight) + overscan * 2
    lastRow = Math.min(rows, firstRow + visibleRows)
  }

  const start = firstRow * columns
  const end = Math.min(count, lastRow * columns)
  const offsetTop = firstRow * rowHeight

  return { start, end, totalHeight, offsetTop }
}
