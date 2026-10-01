import { getAddress, isAddress } from 'viem'
import { NATIVE_ETH, WETH } from '@/lib/constants'
import type { TokenInfo } from '@/lib/types'

export const TOKENS: TokenInfo[] = [
  {
    address: NATIVE_ETH,
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
    slug: 'eth',
    verified: true,
  },
  {
    address: WETH,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    slug: 'weth',
    verified: true,
  },
  {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    slug: 'usdc',
    verified: true,
  },
  {
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    decimals: 8,
    slug: 'cbbtc',
    verified: true,
  },
  {
    address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    symbol: 'AERO',
    name: 'Aerodrome',
    decimals: 18,
    slug: 'aero',
    verified: true,
  },
  {
    address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
    symbol: 'DEGEN',
    name: 'Degen',
    decimals: 18,
    slug: 'degen',
    verified: true,
  },
  {
    address: '0x532f27101965dd16442E59d40670FaF5eBB142E4',
    symbol: 'BRETT',
    name: 'Brett',
    decimals: 18,
    slug: 'brett',
    verified: true,
  },
  {
    address: '0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb',
    symbol: 'CLANKER',
    name: 'tokenbot',
    decimals: 18,
    slug: 'clanker',
    verified: true,
  },
  {
    address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b',
    symbol: 'VIRTUAL',
    name: 'Virtuals Protocol',
    decimals: 18,
    slug: 'virtual',
    verified: true,
  },
  {
    address: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4',
    symbol: 'TOSHI',
    name: 'Toshi',
    decimals: 18,
    slug: 'toshi',
    verified: true,
  },
  {
    address: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
    symbol: 'EURC',
    name: 'EURC',
    decimals: 6,
    slug: 'eurc',
    verified: true,
  },
  {
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    slug: 'usdt',
    verified: true,
  },
  {
    address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    symbol: 'DAI',
    name: 'Dai',
    decimals: 18,
    slug: 'dai',
    verified: true,
  },
  {
    address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    symbol: 'cbETH',
    name: 'Coinbase Wrapped Staked ETH',
    decimals: 18,
    slug: 'cbeth',
    verified: true,
  },
]

const bySlug = new Map(TOKENS.flatMap((token) => (token.slug ? [[token.slug, token] as const] : [])))
const byAddress = new Map(TOKENS.map((token) => [token.address.toLowerCase(), token]))

export function isNative(address: string | undefined | null): boolean {
  return !!address && address.toLowerCase() === NATIVE_ETH.toLowerCase()
}

export function isWeth(address: string | undefined | null): boolean {
  return !!address && address.toLowerCase() === WETH.toLowerCase()
}

export function isEthFamily(address: string | undefined | null): boolean {
  return isNative(address) || isWeth(address)
}

export function sameToken(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

export function findKnown(addressOrSlug: string | undefined | null): TokenInfo | undefined {
  if (!addressOrSlug) return undefined
  const slug = bySlug.get(addressOrSlug.toLowerCase())
  if (slug) return slug
  return byAddress.get(addressOrSlug.toLowerCase())
}

export function tokenParam(address: string): string {
  return findKnown(address)?.slug ?? (isNative(address) ? 'eth' : getAddress(address))
}

export function resolveTokenParam(value: string | undefined, fallback: string): string {
  return parseTokenRoute(value) ?? fallback
}

export function parseTokenRoute(value: string | undefined | null): string | null {
  if (!value) return null
  const known = findKnown(value)
  if (known) return known.address
  if (isAddress(value)) return getAddress(value)
  return null
}

export function toApiAddress(address: string): string {
  if (isNative(address)) return NATIVE_ETH
  return getAddress(address)
}

export function contractAddress(address: string): `0x${string}` | null {
  if (isNative(address) || !isAddress(address)) return null
  return getAddress(address)
}

export function dexLabel(dexId: string): string {
  const known: Record<string, string> = {
    PANCAKE_V3_BASE: 'PancakeSwap V3',
    PANCAKESWAP_V3_BASE: 'PancakeSwap V3',
    UNISWAP_V3_BASE: 'Uniswap V3',
    UNISWAP_V3: 'Uniswap V3',
    AERODROME_SLIPSTREAM_BASE: 'Aerodrome Slipstream',
    AERODROME_V3_BASE: 'Aerodrome Slipstream',
    AERODROME_BASE: 'Aerodrome',
    SLIPSTREAM_BASE: 'Aerodrome Slipstream',
    AERO_SLIPSTREAM: 'Aerodrome Slipstream',
  }
  if (known[dexId]) return known[dexId]
  return dexId
    .replace(/_BASE$/, '')
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

export function tokenHue(address: string): number {
  const known = findKnown(address)
  if (known?.symbol === 'ETH' || known?.symbol === 'WETH') return 226
  if (known?.symbol === 'USDC' || known?.symbol === 'USDT' || known?.symbol === 'DAI') return 210
  if (known?.symbol === 'EURC') return 198
  if (known?.symbol === 'cbBTC') return 28
  if (known?.symbol === 'AERO') return 262
  if (known?.symbol === 'DEGEN') return 312
  if (known?.symbol === 'BRETT') return 38
  if (known?.symbol === 'CLANKER') return 168
  let hash = 0
  const source = address.toLowerCase()
  for (let i = 0; i < source.length; i += 1) hash = (hash * 33 + source.charCodeAt(i)) >>> 0
  return hash % 360
}
