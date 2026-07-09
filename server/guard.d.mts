export function isBlockedIp(ip: string): boolean
export function assertSafeUrl(raw: string): Promise<URL>
export function safeFetch(
  target: string,
  options?: RequestInit,
  maxRedirects?: number,
): Promise<Response>
export function redactUrl(raw: string): string
