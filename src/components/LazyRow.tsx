import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Rendert zijn inhoud pas als de rij (bijna) in beeld komt, met een placeholder
 * van geschatte hoogte ervoor. Reden: een sectie als Films heeft veel rijen met elk
 * honderden posters; alles tegelijk mounten bij het wisselen van tab geeft een
 * merkbare hik. Zo mounten alleen de zichtbare rijen direct, de rest volgt bij het
 * scrollen. Eenmaal getoond blijft de rij gemount (scrollpositie & geen re-mount).
 */
export default function LazyRow({
  children,
  minHeight = 320,
}: {
  children: ReactNode
  minHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (shown) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '800px 0px' }, // ruim vooruit laden zodat scrollen vloeiend blijft
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown])

  return <div ref={ref}>{shown ? children : <div style={{ minHeight }} aria-hidden />}</div>
}
