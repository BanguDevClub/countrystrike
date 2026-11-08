const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const preciseFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** Internal money is millions of USD. */
export function formatMoney(millions: number, precise = false): string {
  if (!Number.isFinite(millions)) return '—'
  const value = millions
  const sign = value < 0 ? '−' : ''
  const abs = Math.abs(value)
  if (abs === 0) return '$0'
  if (abs >= 1_000_000) return `${sign}$${numberFormatter.format(abs / 1_000_000)}T`
  if (abs >= 1_000) return `${sign}$${numberFormatter.format(abs / 1_000)}B`
  if (abs >= 1) return `${sign}$${numberFormatter.format(abs)}M`
  if (abs >= 0.001) return `${sign}$${numberFormatter.format(abs * 1_000)}K`
  return `${sign}$${(precise ? preciseFormatter : numberFormatter).format(abs)}M`
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `$${integerFormatter.format(value)}`
}

export function formatMoneyShort(millions: number): string {
  return formatMoney(millions)
}

export function formatSignedMoney(millions: number): string {
  const formatted = formatMoney(millions)
  return millions > 0 ? `+${formatted}` : formatted
}

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—'
  if (digits === 0 && Math.abs(value) < 10_000) return integerFormatter.format(value)
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value)
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}${numberFormatter.format(abs / 1_000_000)}M`
  if (abs >= 1_000) return `${sign}${numberFormatter.format(abs / 1_000)}k`
  if (abs >= 100) return `${sign}${integerFormatter.format(abs)}`
  if (abs >= 1) return `${sign}${numberFormatter.format(abs)}`
  if (abs === 0) return '0'
  return `${sign}${preciseFormatter.format(abs)}`
}

export function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—'
  return `${value.toFixed(digits)}%`
}

export function formatDecimal(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

export function formatSignedPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`
}

export function formatSignedNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp))
}

export function titleCase(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
}

export function ordinal(value: number): string {
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? 'th'
      : value % 10 === 1
        ? 'st'
        : value % 10 === 2
          ? 'nd'
          : value % 10 === 3
            ? 'rd'
            : 'th'
  return `${value}${suffix}`
}

export function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value
}
