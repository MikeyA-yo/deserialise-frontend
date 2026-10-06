import { getAddress, hexToBigInt, isAddress, isHex } from 'viem'
import { API_BASE, CHAIN_KEY, NATIVE_ETH, SWAP_PROXY, WETH } from '@/lib/constants'
import { isNative, toApiAddress } from '@/lib/tokens'
import type {
  NormalizedQuote,
  QuoteResult,
  QuoteRoute,
  QuoteRouteHop,
  QuoteRouteToken,
  RouteHop,
  SwapTransaction,
  TokenInfo,
} from '@/lib/types'

export class ApiError extends Error {
  status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function endpoint(path: string): string {
  return `${API_BASE}/${CHAIN_KEY}${path}`
}

async function request(path: string, init: RequestInit = {}, timeoutMs = 12_000): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs)
  const parent = init.signal
  const onParentAbort = () => controller.abort('parent')
  parent?.addEventListener('abort', onParentAbort)

  try {
    const response = await fetch(endpoint(path), {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
    const text = await response.text()
    const body = text ? parseBody(text) : null
    if (!response.ok) {
      throw new ApiError(messageFrom(body) ?? `Aggregator request failed (${response.status}).`, response.status)
    }
    return body
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (controller.signal.aborted && controller.signal.reason === 'timeout') {
      throw new ApiError('The aggregator took too long to answer.')
    }
    if (parent?.aborted) throw error
    throw new ApiError('Can’t reach the Deserialize aggregator. Check that it is running and the API URL is set.')
  } finally {
    clearTimeout(timeout)
    parent?.removeEventListener('abort', onParentAbort)
  }
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    if (text.includes('<html') || text.includes('<!DOCTYPE')) {
      return { message: 'The aggregator returned an invalid response.' }
    }
    return { message: text.replace(/\s+/g, ' ').trim().slice(0, 180) }
  }
}

function messageFrom(body: unknown): string | null {
  if (!body) return null
  if (typeof body === 'string') return body.slice(0, 280)
  if (typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  for (const key of ['message', 'error', 'detail', 'reason']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 280)
    if (typeof value === 'object' && value && 'message' in value) {
      const nested = (value as { message?: unknown }).message
      if (typeof nested === 'string' && nested.trim()) return nested.trim().slice(0, 280)
    }
  }
  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function unwrap(body: unknown): Record<string, unknown> {
  const record = asRecord(body)
  if (!record) throw new ApiError('The aggregator returned an unexpected response.')
  if ('amountOut' in record || 'symbol' in record || 'result' in record) return record
  const nested = asRecord(record.data) ?? asRecord(record.quote)
  return nested ?? record
}

export async function getTokenPrice(address: string, signal?: AbortSignal): Promise<number> {
  const target = isNative(address) ? WETH : toApiAddress(address)
  const body = unwrap(await request(`/tokenPrice/${target}`, { signal }))
  const result = body.result ?? body.price ?? body.usd
  const price = typeof result === 'number' ? result : typeof result === 'string' ? Number(result) : NaN
  if (!Number.isFinite(price) || price < 0) throw new ApiError('No USD price for this token.')
  return price
}

export async function getTokenDetails(address: string, signal?: AbortSignal): Promise<TokenInfo> {
  if (isNative(address)) {
    return { address: NATIVE_ETH, symbol: 'ETH', name: 'Ether', decimals: 18, slug: 'eth', verified: true }
  }
  const checksum = getAddress(address)
  const rawBody = unwrap(await request(`/tokenDetails/${checksum}`, { signal }))
  const body = asRecord(rawBody.result) ?? rawBody
  const decimals = body.decimals
  const symbol = body.symbol
  const name = body.name
  if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new ApiError('Token metadata is missing decimals.')
  }
  if (typeof symbol !== 'string' || !symbol.trim()) throw new ApiError('Token metadata is missing a symbol.')
  return {
    address: typeof body.address === 'string' && isAddress(body.address) ? getAddress(body.address) : checksum,
    symbol: symbol.trim().slice(0, 20),
    name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 64) : symbol.trim(),
    decimals,
    verified: false,
  }
}

export function toBigInt(value: unknown): bigint {
  if (value == null || value === '' || value === '0x' || value === '0x0') return 0n
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return 0n
    if (Number.isSafeInteger(value)) return BigInt(value)
    return BigInt(Math.floor(value))
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      return hexToBigInt(trimmed as `0x${string}`)
    }
    if (/^\d+$/.test(trimmed)) {
      return BigInt(trimmed)
    }
    if (/[eE]/.test(trimmed)) {
      const parts = trimmed.toLowerCase().split('e')
      const mantissa = parts[0]
      const expStr = parts[1]
      const exp = expStr ? parseInt(expStr, 10) : NaN
      if (mantissa && !Number.isNaN(exp) && exp >= 0) {
        const [intPart = '', fracPart = ''] = mantissa.split('.')
        const combined = intPart + fracPart
        const shift = exp - fracPart.length
        if (shift >= 0) {
          const res = combined + '0'.repeat(shift)
          if (/^\d+$/.test(res)) return BigInt(res)
        } else {
          const res = combined.slice(0, combined.length + shift)
          if (/^\d+$/.test(res)) return BigInt(res)
        }
      }
      const num = Number(trimmed)
      if (!Number.isNaN(num) && Number.isFinite(num) && num >= 0) {
        return BigInt(Math.floor(num))
      }
    }
    if (/^\d+\.\d+$/.test(trimmed)) {
      const dotIndex = trimmed.indexOf('.')
      const intPart = dotIndex !== -1 ? trimmed.slice(0, dotIndex) : trimmed
      if (/^\d+$/.test(intPart)) return BigInt(intPart)
    }
  }
  return 0n
}

function integerString(value: unknown, field: string): string {
  if (value == null) throw new ApiError(`Quote is missing a valid ${field}.`)
  try {
    const bi = toBigInt(value)
    if (bi > 0n || value === 0 || value === '0' || value === 0n) {
      return bi.toString()
    }
  } catch {
    // fall through
  }
  throw new ApiError(`Quote is missing a valid ${field}.`)
}

function asHop(value: unknown): RouteHop | null {
  const hop = asRecord(value)
  if (!hop) return null
  if (typeof hop.tokenA !== 'string' || typeof hop.tokenB !== 'string') return null
  const fee = typeof hop.fee === 'number' ? hop.fee : typeof hop.fee === 'string' ? Number(hop.fee) : 0
  return {
    tokenA: hop.tokenA,
    tokenB: hop.tokenB,
    dexId: typeof hop.dexId === 'string' ? hop.dexId : 'UNKNOWN',
    poolAddress: typeof hop.poolAddress === 'string' ? hop.poolAddress : '',
    aToB: Boolean(hop.aToB),
    fee: Number.isFinite(fee) ? fee : 0,
  }
}

function asRoute(value: unknown): QuoteRoute | undefined {
  if (!value || typeof value !== 'object') return undefined
  const r = value as Record<string, unknown>
  if (!Array.isArray(r.hops) || !Array.isArray(r.path)) return undefined

  const path: QuoteRouteToken[] = []
  for (const item of r.path) {
    if (item && typeof item === 'object') {
      const p = item as Record<string, unknown>
      if (typeof p.address === 'string') {
        path.push({
          address: p.address,
          symbol: typeof p.symbol === 'string' ? p.symbol : null,
          decimals: typeof p.decimals === 'number' ? p.decimals : null,
        })
      }
    }
  }

  const hops: QuoteRouteHop[] = []
  for (const item of r.hops) {
    if (item && typeof item === 'object') {
      const h = item as Record<string, unknown>
      const tokenIn = h.tokenIn && typeof h.tokenIn === 'object' ? (h.tokenIn as Record<string, unknown>) : null
      const tokenOut = h.tokenOut && typeof h.tokenOut === 'object' ? (h.tokenOut as Record<string, unknown>) : null
      if (tokenIn && tokenOut && typeof tokenIn.address === 'string' && typeof tokenOut.address === 'string') {
        hops.push({
          hop: typeof h.hop === 'number' ? h.hop : hops.length + 1,
          dexId: typeof h.dexId === 'string' ? h.dexId : 'UNKNOWN',
          dexName: typeof h.dexName === 'string' ? h.dexName : 'DEX Pool',
          poolAddress: typeof h.poolAddress === 'string' ? h.poolAddress : '',
          fee: typeof h.fee === 'number' ? h.fee : 0,
          tokenIn: {
            address: tokenIn.address,
            symbol: typeof tokenIn.symbol === 'string' ? tokenIn.symbol : null,
            decimals: typeof tokenIn.decimals === 'number' ? tokenIn.decimals : null,
          },
          tokenOut: {
            address: tokenOut.address,
            symbol: typeof tokenOut.symbol === 'string' ? tokenOut.symbol : null,
            decimals: typeof tokenOut.decimals === 'number' ? tokenOut.decimals : null,
          },
          amountIn: typeof h.amountIn === 'string' || typeof h.amountIn === 'number' ? String(h.amountIn) : '0',
          amountOut: typeof h.amountOut === 'string' || typeof h.amountOut === 'number' ? String(h.amountOut) : '0',
          amountInFormatted:
            typeof h.amountInFormatted === 'string' || typeof h.amountInFormatted === 'number'
              ? String(h.amountInFormatted)
              : null,
          amountOutFormatted:
            typeof h.amountOutFormatted === 'string' || typeof h.amountOutFormatted === 'number'
              ? String(h.amountOutFormatted)
              : null,
          percent: typeof h.percent === 'number' ? h.percent : 100,
        })
      }
    }
  }

  return {
    path,
    hops,
    summary:
      typeof r.summary === 'string'
        ? r.summary
        : path.map((p) => p.symbol ?? p.address.slice(0, 6)).join(' → '),
  }
}

function normalizeQuote(raw: Record<string, unknown>): NormalizedQuote {
  const route = Array.isArray(raw.routePlan) ? raw.routePlan.map(asHop).filter((hop): hop is RouteHop => !!hop) : []
  const tokenPrice = raw.tokenPrice
  return {
    tokenA: String(raw.tokenA ?? ''),
    tokenB: String(raw.tokenB ?? ''),
    amountIn: integerString(raw.amountIn, 'amount in'),
    amountOut: integerString(raw.amountOut, 'amount out'),
    tokenPrice: typeof tokenPrice === 'string' || typeof tokenPrice === 'number' ? String(tokenPrice) : null,
    routePlan: route,
    route: asRoute(raw.route),
    dexId: typeof raw.dexId === 'string' ? raw.dexId : 'ALL_BASE',
    isNativeIn: Boolean(raw.isNativeIn),
    isNativeOut: Boolean(raw.isNativeOut),
  }
}

export async function getQuote(input: {
  tokenA: string
  tokenB: string
  amountIn: string
  signal?: AbortSignal
}): Promise<QuoteResult> {
  const body = unwrap(
    await request(
      '/quote',
      {
        method: 'POST',
        signal: input.signal,
        body: JSON.stringify({
          tokenA: toApiAddress(input.tokenA),
          tokenB: toApiAddress(input.tokenB),
          amountIn: input.amountIn,
          dexId: 'ALL_BASE',
        }),
      },
      20_000,
    ),
  )
  return { raw: body, quote: normalizeQuote(body) }
}

export async function getQuoteForAmountOut(input: {
  tokenA: string
  tokenB: string
  amountOut: bigint
  decimalsA: number
  decimalsB: number
  priceA?: number | null
  priceB?: number | null
  signal?: AbortSignal
}): Promise<QuoteResult> {
  const { tokenA, tokenB, amountOut, decimalsA, decimalsB, priceA, priceB, signal } = input
  if (amountOut <= 0n) throw new ApiError('Enter an amount.')

  let estIn: bigint
  if (priceA && priceB && priceA > 0 && priceB > 0) {
    const targetUsd = (Number(amountOut) / 10 ** decimalsB) * priceB
    const estA = targetUsd / priceA
    estIn = BigInt(Math.max(1, Math.floor(estA * 10 ** decimalsA)))
  } else {
    const oneUnitA = 10n ** BigInt(decimalsA)
    const probe = await getQuote({ tokenA, tokenB, amountIn: oneUnitA.toString(), signal })
    const probeOut = toBigInt(probe.quote.amountOut)
    if (probeOut <= 0n) throw new ApiError('No liquidity found for this pair.')
    estIn = (amountOut * oneUnitA + probeOut - 1n) / probeOut
  }
  if (estIn <= 0n) estIn = 1n

  const quote1 = await getQuote({ tokenA, tokenB, amountIn: estIn.toString(), signal })
  const out1 = toBigInt(quote1.quote.amountOut)
  if (out1 <= 0n) return quote1

  const diff = out1 >= amountOut ? out1 - amountOut : amountOut - out1
  if (diff * 200n <= amountOut) {
    return quote1
  }

  const refinedIn = (amountOut * estIn + out1 - 1n) / out1
  if (refinedIn <= 0n || refinedIn === estIn) {
    return quote1
  }

  try {
    const quote2 = await getQuote({ tokenA, tokenB, amountIn: refinedIn.toString(), signal })
    return quote2
  } catch {
    return quote1
  }
}

function parseTxValue(value: unknown): bigint {
  return toBigInt(value)
}

export function prepareTransactions(
  transactions: unknown,
  sellToken: string,
): SwapTransaction[] {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    throw new ApiError('The aggregator did not return a transaction.')
  }
  const proxy = SWAP_PROXY.toLowerCase()
  const sell = isNative(sellToken) ? null : sellToken.toLowerCase()

  return transactions.map((item, index) => {
    const tx = asRecord(item)
    if (!tx || typeof tx.to !== 'string' || !isAddress(tx.to)) {
      throw new ApiError('Swap transaction is missing a destination.')
    }
    const to = getAddress(tx.to)
    const data = tx.data
    if (typeof data !== 'string' || !isHex(data, { strict: true }) || data.length < 10) {
      throw new ApiError('Swap transaction is missing calldata.')
    }
    const destination = to.toLowerCase()
    const value = parseTxValue(tx.value)
    let kind: SwapTransaction['kind']
    if (destination === proxy) kind = 'swap'
    else if (sell && destination === sell) kind = 'approve'
    else throw new ApiError('Refusing a transaction aimed at an unexpected contract.')

    if (kind === 'approve' && value !== 0n) {
      throw new ApiError('Approval transaction tried to send ETH.')
    }
    if (kind === 'swap' && index !== transactions.length - 1) {
      throw new ApiError('The swap transaction was not the last step.')
    }
    if (kind === 'approve' && index === transactions.length - 1) {
      throw new ApiError('The swap transaction was missing.')
    }
    return { from: typeof tx.from === 'string' ? tx.from : undefined, to, data, value, kind }
  })
}

export async function buildSwap(input: {
  publicKey: `0x${string}`
  quote: Record<string, unknown>
  slippage: number
  sellToken: string
  partnerFees?: { recipient: `0x${string}`; fee: number }
}): Promise<SwapTransaction[]> {
  const payload: Record<string, unknown> = {
    publicKey: input.publicKey,
    quote: input.quote,
    slippage: input.slippage,
  }
  if (input.partnerFees) payload.partnerFees = input.partnerFees

  const body = unwrap(
    await request('/swap', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 20_000),
  )
  const resultObj = asRecord(body.result)
  const transactions = body.transactions ?? body.txs ?? resultObj?.transactions ?? resultObj?.txs
  return prepareTransactions(transactions, input.sellToken)
}

export function partnerFeesFromEnv(): { recipient: `0x${string}`; fee: number } | undefined {
  const recipient = import.meta.env.VITE_PARTNER_FEE_RECIPIENT
  const fee = Number(import.meta.env.VITE_PARTNER_FEE_PERCENT)
  if (!recipient || !isAddress(recipient)) return undefined
  if (!Number.isFinite(fee) || fee <= 0 || fee > 10) return undefined
  return { recipient: getAddress(recipient), fee }
}

export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) {
    if (/user rejected|user denied|rejected the request|denied transaction/i.test(error.message)) {
      return 'You rejected the request in your wallet.'
    }
    if (/insufficient funds/i.test(error.message)) {
      return 'Not enough ETH to cover the amount and network fee.'
    }
    // Wallet RPC still a block behind a just-confirmed approval: the swap reused its nonce
    if (/nonce too low|nonce has already been used|nonce expired|invalid nonce/i.test(error.message)) {
      return 'Your wallet had not caught up with the approval yet. The approval went through, so tap the button again to send the swap.'
    }
    const cleaned = error.message.replace(/^Error:\s*/, '')
    return cleaned.length > 240 ? `${cleaned.slice(0, 240)}…` : cleaned
  }
  return 'Something went wrong.'
}
