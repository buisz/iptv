export function ttlFor(contentType: string | null | undefined): number
export function cacheGet(
  key: string,
): { body: Buffer; contentType: string | null; expires: number } | null
export function cacheSet(
  key: string,
  body: Buffer,
  contentType: string | null,
  ttl: number,
): void
export function withHostLimit<T>(host: string, fn: () => Promise<T>): Promise<T>
export function hostOf(target: string): string
