/**
 * Gedeelde scroll-vergrendeling met telling.
 *
 * Meerdere overlays kunnen tegelijk/gestapeld open zijn (bijv. detail → speler).
 * Per-overlay `document.body.style.overflow` opslaan/herstellen gaat dan mis: de
 * binnenste vangt 'hidden' op en zet die terug, waardoor de pagina blijft hangen.
 * Deze teller herstelt de scroll pas als de láátste overlay sluit.
 */
let count = 0
let prevOverflow = ''

export function lockScroll(): void {
  if (typeof document === 'undefined') return
  if (count === 0) {
    prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  count++
}

export function unlockScroll(): void {
  if (typeof document === 'undefined') return
  count = Math.max(0, count - 1)
  if (count === 0) {
    document.body.style.overflow = prevOverflow
  }
}
