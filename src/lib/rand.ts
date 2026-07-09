/** Willekeurig element uit een lijst, of undefined als de lijst leeg is. */
export function pickRandom<T>(list: T[]): T | undefined {
  if (!list.length) return undefined
  return list[Math.floor(Math.random() * list.length)]
}
