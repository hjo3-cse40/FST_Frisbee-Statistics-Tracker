const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

/** Minimum contrast for jersey UI chrome (borders, chips, selection highlights). */
const MIN_LUMINANCE = 0.15
const MAX_LUMINANCE = 0.85

export function hexLuminance(hex: string): number {
  if (!HEX_COLOR.test(hex)) return 0.5
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export function isUsableJerseyColor(hex: string): boolean {
  if (!HEX_COLOR.test(hex)) return false
  const lum = hexLuminance(hex)
  return lum >= MIN_LUMINANCE && lum <= MAX_LUMINANCE
}

export function resolveJerseyColor(
  gameColor: string | null | undefined,
  teamColor: string | null | undefined,
  fallback: string
): string {
  const candidate = (gameColor || teamColor || '').trim()
  if (!isUsableJerseyColor(candidate)) {
    return fallback
  }
  return candidate
}

export function contrastingTextColor(hex: string): string {
  if (!HEX_COLOR.test(hex)) return '#ffffff'
  return hexLuminance(hex) > 0.55 ? '#111827' : '#ffffff'
}

export function jerseyTint(color: string, alphaSuffix = '20'): string {
  if (!HEX_COLOR.test(color)) {
    return 'var(--bg-tertiary)'
  }
  return `${color}${alphaSuffix}`
}
