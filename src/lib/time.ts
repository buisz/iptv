/** Tijd-/datumweergave voor de EPG. Toont de datum wanneer iets niet vandaag is,
 *  zodat een uitzending van (bijv.) vrijdag niet als "nu/vandaag" wordt gelezen. */

export function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function sameDay(a: number, b: number): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

/** "HH:MM" als het vandaag is; anders "morgen HH:MM" of "vr 11 jul HH:MM". */
export function fmtTime(ms: number, ref: number = Date.now()): string {
  const hm = clock(ms)
  if (sameDay(ms, ref)) return hm
  const tomorrow = new Date(ref)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (sameDay(ms, tomorrow.getTime())) return `morgen ${hm}`
  const date = new Date(ms).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${date} ${hm}`
}
