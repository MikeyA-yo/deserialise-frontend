export type TokenInfo = {
  address: string
  symbol: string
  name: string
  decimals: number
  slug?: string
  verified?: boolean
}

export type RouteHop = {
  tokenA: string
  tokenB: string
  dexId: string
  poolAddress: string
  aToB: boolean
  fee: number
}

export type NormalizedQuote = {
  tokenA: string
  tokenB: string
  amountIn: string
  amountOut: string
  tokenPrice: string | null
  routePlan: RouteHop[]
  dexId: string
  isNativeIn: boolean
  isNativeOut: boolean
}

/** Raw quote body, preserved so POST /swap receives the aggregator's object. */
export type QuoteResult = {
  raw: Record<string, unknown>
  quote: NormalizedQuote
}

export type SwapTransaction = {
  from?: string
  to: `0x${string}`
  data: `0x${string}`
  value: bigint
  kind: 'approve' | 'swap'
}

export type ActivityItem = {
  id: string
  hash: `0x${string}`
  sellSymbol: string
  buySymbol: string
  sellAddress: string
  buyAddress: string
  amountIn: string
  amountOut: string
  timestamp: number
}

export type SwapSettings = {
  slippage: number
}
