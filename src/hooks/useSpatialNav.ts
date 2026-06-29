import { useEffect } from 'react'

/**
 * Lichte spatial-navigation voor pijltjestoetsen / TV-remote.
 *
 * Werkt op alle elementen met `data-nav-item` binnen de meegegeven container.
 * Elk item draagt `data-row` en `data-col`. Links/rechts beweegt binnen een rij,
 * omhoog/omlaag springt naar het dichtstbijzijnde item in de aangrenzende rij.
 * Het gefocuste item wordt netjes in beeld gescrold (horizontaal binnen de rij,
 * verticaal binnen de pagina).
 *
 * Tab/Shift+Tab blijven gewoon werken; dit voegt alleen het rasterpatroon toe
 * dat gebruikers van een afstandsbediening verwachten.
 */
export function useSpatialNav(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    function focusItem(el: HTMLElement | null) {
      if (!el) return
      el.focus()
      el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
    }

    function onKeyDown(e: KeyboardEvent) {
      const keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']
      if (!keys.includes(e.key)) return

      const active = document.activeElement as HTMLElement | null
      if (!active || active.dataset.navItem === undefined) return

      const row = Number(active.dataset.row)
      const col = Number(active.dataset.col)
      if (Number.isNaN(row) || Number.isNaN(col)) return

      const all = Array.from(
        document.querySelectorAll<HTMLElement>('[data-nav-item]'),
      )
      const inRow = (r: number) =>
        all
          .filter((el) => Number(el.dataset.row) === r)
          .sort((a, b) => Number(a.dataset.col) - Number(b.dataset.col))

      let target: HTMLElement | null = null

      if (e.key === 'ArrowRight') {
        target = inRow(row).find((el) => Number(el.dataset.col) === col + 1) ?? null
      } else if (e.key === 'ArrowLeft') {
        target = inRow(row).find((el) => Number(el.dataset.col) === col - 1) ?? null
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const nextRow = inRow(e.key === 'ArrowDown' ? row + 1 : row - 1)
        if (nextRow.length) {
          // Kies het item in de nieuwe rij met de dichtstbijzijnde kolom.
          target = nextRow.reduce((best, el) => {
            const d = Math.abs(Number(el.dataset.col) - col)
            const bd = Math.abs(Number(best.dataset.col) - col)
            return d < bd ? el : best
          })
        }
      }

      if (target) {
        e.preventDefault()
        focusItem(target)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
