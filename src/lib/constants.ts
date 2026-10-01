export const CHAIN_KEY = 'base'

/** Native ETH sentinel expected by the aggregator. Not a contract. */
export const NATIVE_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export const WETH = '0x4200000000000000000000000000000000000006'
export const SWAP_PROXY = '0xADb0018bCF10b7dD84B7C3e2D92889185DA41f45'
export const ADAPTER_TRACKER = '0xf0c3D4dE61d78742Eb51dffA29A109aCE473892F'

export const BASESCAN = 'https://basescan.org'

export const PRODUCTION_API = 'https://evm-api.deserialize.xyz'

export const API_BASE =
  import.meta.env.VITE_AGGREGATOR_URL?.replace(/\/$/, '') ||
  (import.meta.env.DEV ? 'http://localhost:3735' : PRODUCTION_API)

export const GAS_RESERVE = 150_000_000_000_000n // 0.00015 ETH

export const DEFAULT_SLIPPAGE = 0.5
export const MIN_SLIPPAGE = 0.1
export const MAX_SLIPPAGE = 10

export const QUOTE_DEBOUNCE_MS = 350
export const QUOTE_REFRESH_MS = 12_000
export const QUOTE_STALE_MS = 15_000
