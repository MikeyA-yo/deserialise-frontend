export const CHAIN_KEY = 'base'

/** Native ETH sentinel expected by the aggregator. Not a contract. */
export const NATIVE_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export const WETH = '0x4200000000000000000000000000000000000006'
// Base contracts redeployed Oct 5, 2026 (MultiRouteSwapV2 proxy + AdapterTracker)
export const SWAP_PROXY = '0x2B7b17165aAe7Ce6cC390920282473720Db8b30b'
export const ADAPTER_TRACKER = '0xbC9eB41b40be480541b54A4189bB82c4340378a7'

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
