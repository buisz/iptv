import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Altijd-zichtbare, sleepbare horizontale scrollbalk voor een scroll-container.
 *
 * Waarom niet de native scrollbar: macOS/Edge verbergen overlay-scrollbars tot je
 * scrollt, ondanks `::-webkit-scrollbar`-styling. Deze balk staat er altijd, is met
 * de muis te slepen én klikbaar (klik op de baan springt ernaartoe). Werkt identiek
 * op web, tablet en TV omdat hij niet van OS-instellingen afhangt.
 *
 * De balk stuurt `targetRef.scrollLeft` aan en volgt omgekeerd elke scroll (wiel,
 * touch, toetsenbord) zodat de duim altijd klopt.
 */
export default function HScrollbar({ targetRef }: { targetRef: React.RefObject<HTMLElement | null> }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState({ width: 0, left: 0, visible: false })
  const drag = useRef<{ startX: number; startLeft: number } | null>(null)

  const sync = useCallback(() => {
    const el = targetRef.current
    const track = trackRef.current
    if (!el || !track) return
    const trackW = track.clientWidth
    const maxScroll = el.scrollWidth - el.clientWidth
    if (maxScroll <= 1 || el.scrollWidth <= 0) {
      setThumb((t) => (t.visible ? { ...t, visible: false } : t))
      return
    }
    const width = Math.max(40, (el.clientWidth / el.scrollWidth) * trackW)
    const left = (el.scrollLeft / maxScroll) * (trackW - width)
    setThumb({ width, left, visible: true })
  }, [targetRef])

  // Volg scroll/resize van de container.
  useEffect(() => {
    const el = targetRef.current
    if (!el) return
    sync()
    el.addEventListener('scroll', sync, { passive: true })
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(sync)
      ro.observe(el)
    } else {
      window.addEventListener('resize', sync)
    }
    return () => {
      el.removeEventListener('scroll', sync)
      if (ro) ro.disconnect()
      else window.removeEventListener('resize', sync)
    }
  }, [targetRef, sync])

  // Slepen van de duim.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current
      const el = targetRef.current
      const track = trackRef.current
      if (!d || !el || !track) return
      const trackW = track.clientWidth
      const maxScroll = el.scrollWidth - el.clientWidth
      const travel = trackW - thumb.width
      if (travel <= 0) return
      const dx = e.clientX - d.startX
      el.scrollLeft = d.startLeft + (dx / travel) * maxScroll
    }
    const onUp = () => {
      if (!drag.current) return
      drag.current = null
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [targetRef, thumb.width])

  const onThumbDown = (e: React.PointerEvent) => {
    const el = targetRef.current
    if (!el) return
    e.stopPropagation()
    e.preventDefault()
    drag.current = { startX: e.clientX, startLeft: el.scrollLeft }
    document.body.style.userSelect = 'none'
  }

  // Klik op de baan → spring zodat de duim onder de klik centreert.
  const onTrackDown = (e: React.PointerEvent) => {
    const el = targetRef.current
    const track = trackRef.current
    if (!el || !track) return
    const rect = track.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const travel = track.clientWidth - thumb.width
    const maxScroll = el.scrollWidth - el.clientWidth
    if (travel <= 0) return
    const target = ((clickX - thumb.width / 2) / travel) * maxScroll
    el.scrollLeft = Math.max(0, Math.min(maxScroll, target))
  }

  if (!thumb.visible) return null

  return (
    <div
      ref={trackRef}
      onPointerDown={onTrackDown}
      className="relative mt-1 h-3 w-full cursor-pointer rounded-full bg-white/[0.06]"
      role="scrollbar"
      aria-orientation="horizontal"
    >
      <div
        onPointerDown={onThumbDown}
        style={{ width: thumb.width, transform: `translateX(${thumb.left}px)` }}
        className="absolute inset-y-0 rounded-full bg-white/40 transition-colors hover:bg-buisgroen active:bg-buisgroen"
      />
    </div>
  )
}
