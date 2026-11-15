/* ── Hex colour helpers ───────────────────────────────────────────────── */

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '').trim()
  const normalized =
    value.length === 3
      ? value
          .split('')
          .map((channel) => `${channel}${channel}`)
          .join('')
      : value
  const parsed = Number.parseInt(normalized.slice(0, 6), 16)
  if (!Number.isFinite(parsed)) return [128, 128, 128]
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255]
}

function rgbToHex(rgb: Rgb): string {
  return `#${rgb
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

function mixHex(from: string, to: string, amount: number): string {
  const t = Math.max(0, Math.min(1, amount))
  const a = hexToRgb(from)
  const b = hexToRgb(to)
  return rgbToHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
}

/** Positive amounts lighten toward white, negative amounts darken toward black. */
export function shadeHex(hex: string, amount: number): string {
  return amount >= 0 ? mixHex(hex, '#ffffff', amount) : mixHex(hex, '#000000', -amount)
}
