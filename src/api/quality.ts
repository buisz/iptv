/**
 * Kwaliteit/codec-hint afleiden uit een stream-/kanaalnaam (heuristiek).
 *
 * IPTV-aanbieders stoppen resolutie vaak ín de naam ("BBC One FHD", "Film 4K UHD").
 * Codec staat er zelden bij, maar soms wel ("... HEVC", "[H265]"). Wat we hier
 * afleiden is dus een *hint* (`from: 'name'`), geen harde waarheid — de UI behandelt
 * het conservatief.
 */
import type { QualityHint } from '../types/content'

const RES_4K = /\b(4k|uhd|2160p?)\b/i
const RES_FHD = /\b(fhd|1080p?|full\s?hd)\b/i
const RES_HD = /\b(hd|720p?)\b/i
const RES_SD = /\b(sd|480p?|360p?)\b/i

const CODEC_HEVC = /\b(hevc|h\.?265|x265)\b/i
const CODEC_AV1 = /\bav1\b/i
const CODEC_H264 = /\b(h\.?264|x264|avc)\b/i

/** Leid een resolutie/codec-hint uit een naam af; geeft `undefined` als niets matcht. */
export function qualityFromName(name: string): QualityHint | undefined {
  if (!name) return undefined
  const hint: QualityHint = { from: 'name' }

  if (RES_4K.test(name)) hint.res = '4k'
  else if (RES_FHD.test(name)) hint.res = 'fhd'
  else if (RES_HD.test(name)) hint.res = 'hd'
  else if (RES_SD.test(name)) hint.res = 'sd'

  if (CODEC_AV1.test(name)) hint.codec = 'av1'
  else if (CODEC_HEVC.test(name)) hint.codec = 'hevc'
  else if (CODEC_H264.test(name)) hint.codec = 'h264'

  return hint.res || hint.codec ? hint : undefined
}

/** Normaliseer een codec-string uit provider-metadata naar onze enum. */
export function normalizeCodec(raw?: string): QualityHint['codec'] | undefined {
  if (!raw) return undefined
  const s = raw.toLowerCase()
  if (s.includes('av1')) return 'av1'
  if (s.includes('hevc') || s.includes('265')) return 'hevc'
  if (s.includes('264') || s.includes('avc') || s.includes('h264')) return 'h264'
  return undefined
}

/** Leid een resolutie-enum af uit een hoogte (pixels) uit metadata. */
export function resFromHeight(height?: number): QualityHint['res'] | undefined {
  if (!height || !isFinite(height)) return undefined
  if (height >= 1700) return '4k'
  if (height >= 900) return 'fhd'
  if (height >= 560) return 'hd'
  return 'sd'
}
