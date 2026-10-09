import { formatUnits, parseUnits } from 'viem'

const GROUP = /\B(?=(\d{3})+(?!\d))/g

export function sanitizeAmount(raw: string, decimals: number): string {
  const cleaned = raw.replace(/,/g, '').replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned.replace(/^0+(?=\d)/, '')

  const whole = cleaned.slice(0, firstDot).replace(/^0+(?=\d)/, '')
  const frac = cleaned
    .slice(firstDot + 1)
    .replace(/\./g, '')
    .slice(0, decimals)
  return `${whole}.${frac}`
}

export function tryParseAmount(raw: string, decimals: number): bigint | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '.') return null
  const [whole, frac = ''] = trimmed.split('.')
  if (frac.length > decimals) return null
  if (!/^\d*$/.test(whole ?? '') || !/^\d*$/.test(frac)) return null
  try {
    const normalized = frac.length > 0 ? `${whole || '0'}.${frac}` : whole || '0'
    return parseUnits(normalized, decimals)
  } catch {
    return null
  }
}

/** Truncates extra fraction digits. Never rounds up. */
export function formatUnitsTrim(value: bigint, decimals: number, maxFrac = 6): string {
  if (value === 0n) return '0'
  const negative = value < 0n
  const abs = negative ? -value : value
  const scale = 10n ** BigInt(decimals)
  const whole = abs / scale
  const frac = abs % scale
  const fracFull = decimals > 0 ? frac.toString().padStart(decimals, '0') : ''
  const kept = fracFull.slice(0, maxFrac).replace(/0+$/, '')
  if (whole === 0n && kept === '') {
    const zeros = Math.max(maxFrac - 1, 1)
    return `<0.${'0'.repeat(zeros)}1`
  }
  const wholeText = whole.toString().replace(GROUP, ',')
  const body = kept ? `${wholeText}.${kept}` : wholeText
  return negative ? `-${body}` : body
}

export function formatTokenAmount(value: bigint, decimals: number): string {
  return formatUnitsTrim(value, decimals, value > 10n ** BigInt(decimals) * 1000n ? 2 : 6)
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value > 0 && value < 0.01) return '<$0.01'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value)
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value > 0 && value < 0.0001) return '<$0.0001'
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : 6
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
  }).format(value)
}

/** $1.2B / $34.5M / $812K style, for market cap and volume */
export function formatCompactUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: value >= 1000 ? 1 : 2,
  }).format(value)
}

export function formatPercent(value: number): string {
  const abs = Math.abs(value)
  if (abs > 0 && abs < 0.01) return `${value < 0 ? '-' : ''}<0.01%`
  return `${value.toFixed(2)}%`
}

export function formatFeeTier(fee: number): string {
  if (!Number.isFinite(fee)) return '—'
  const percent = fee / 10_000
  const text = percent.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  return `${text}%`
}

export function shortAddress(address: string, size = 4): string {
  if (address.length < 10) return address
  return `${address.slice(0, 2 + size)}…${address.slice(-size)}`
}

export function relativeTime(timestamp: number, now = Date.now()): string {
  const delta = Math.max(0, now - timestamp)
  const minutes = Math.floor(delta / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(timestamp)
}

export function amountToUsd(amount: bigint | null, decimals: number, price: number | null): number | null {
  if (amount == null || price == null || !Number.isFinite(price)) return null
  const asNumber = Number(formatUnits(amount, decimals))
  if (!Number.isFinite(asNumber)) return null
  return asNumber * price
}

export function applySlippage(amountOut: string, slippagePercent: number): bigint {
  const out = BigInt(amountOut)
  const bps = BigInt(Math.round(slippagePercent * 100))
  if (bps < 0n || bps >= 10_000n) return out
  return (out * (10_000n - bps)) / 10_000n
}

export function priceImpact(usdIn: number | null, usdOut: number | null): number | null {
  if (usdIn == null || usdOut == null || usdIn <= 0) return null
  return ((usdIn - usdOut) / usdIn) * 100
}

export function executionRate(amountIn: bigint, amountOut: bigint, inDecimals: number, outDecimals: number): number | null {
  const input = Number(formatUnits(amountIn, inDecimals))
  const output = Number(formatUnits(amountOut, outDecimals))
  if (!Number.isFinite(input) || !Number.isFinite(output) || input === 0) return null
  return output / input
}

export function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return '—'
  if (rate > 0 && rate < 0.000001) return '<0.000001'
  const digits = rate >= 1000 ? 2 : rate >= 1 ? 4 : 6
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(rate)
}
