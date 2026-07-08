export const STREAM_UA: string
export const BROWSER_UA: string
export function looksLikeErrorPage(contentType: string | null | undefined): boolean
export function isM3u8(contentType: string | null | undefined, targetUrl: string): boolean
export function rewriteM3u8(text: string, baseUrl: string): string
