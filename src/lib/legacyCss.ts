/**
 * Feature-detectie voor flex `gap` (Chrome 84+). Op oudere TV-engines valt de
 * tussenruimte in flex-rijen weg; we kunnen dit niet betrouwbaar met @supports
 * detecteren (grid-gap bestaat al eerder), dus meten we het en zetten `no-flexgap`
 * op <html> zodat de marge-fallbacks in index.css aanslaan.
 */
export function markFlexGapSupport(): void {
  if (typeof document === 'undefined') return
  try {
    const el = document.createElement('div')
    el.style.display = 'flex'
    el.style.flexDirection = 'column'
    el.style.gap = '1px'
    el.appendChild(document.createElement('div'))
    el.appendChild(document.createElement('div'))
    el.style.position = 'absolute'
    el.style.visibility = 'hidden'
    document.body.appendChild(el)
    const supported = el.scrollHeight === 1 // 2 nul-hoogte kinderen + 1px gap
    document.body.removeChild(el)
    if (!supported) document.documentElement.classList.add('no-flexgap')
  } catch {
    /* laat het; zonder detectie gewoon de moderne layout */
  }
}
