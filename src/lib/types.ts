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

export type QuoteRouteToken = {
  address: string
  symbol: string | null
  decimals: number | null
}

export type QuoteRouteHop = {
  hop: number
  dexId: string
  dexName: string
  poolAddress: string
  fee: number
  tokenIn: QuoteRouteToken
  tokenOut: QuoteRouteToken
  amountIn: string
  amountOut: string
  amountInFormatted: string | null
  amountOutFormatted: string | null
  percent: number
}

export type QuoteRoute = {
  path: QuoteRouteToken[]
  hops: QuoteRouteHop[]
  summary: string
}

export type NormalizedQuote = {
  tokenA: string
  tokenB: string
  amountIn: string
  amountOut: string
  tokenPrice: string | null
  routePlan: RouteHop[]
  route?: QuoteRoute
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
