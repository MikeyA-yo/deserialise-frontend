import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { isAddress } from 'viem'
import { friendlyError, getTokenDetails, getTokenPrice } from '@/lib/api'
import { NATIVE_ETH } from '@/lib/constants'
import { getCustomTokens, subscribeCustomTokens } from '@/lib/storage'
import { findKnown, isNative } from '@/lib/tokens'
import type { TokenInfo } from '@/lib/types'

const NATIVE: TokenInfo = {
  address: NATIVE_ETH,
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
  slug: 'eth',
  verified: true,
}

export function useCustomTokens(): TokenInfo[] {
  return useSyncExternalStore(subscribeCustomTokens, getCustomTokens, getCustomTokens)
}

export function useToken(address: string): {
  token: TokenInfo
  ready: boolean
  loading: boolean
  error: string | null
} {
  const custom = useCustomTokens().find((token) => token.address.toLowerCase() === address.toLowerCase())
  const known = findKnown(address) ?? custom
  const canFetch = !isNative(address) && isAddress(address)

  const query = useQuery({
    queryKey: ['token-details', address.toLowerCase()],
    enabled: canFetch,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
    queryFn: ({ signal }) => getTokenDetails(address, signal),
    placeholderData: known,
  })

  if (isNative(address)) {
    return { token: NATIVE, ready: true, loading: false, error: null }
  }

  const token = query.data ?? known
  if (!token) {
    return {
      token: {
        address,
        symbol: address.slice(0, 6),
        name: 'Unknown token',
        decimals: 18,
      },
      ready: false,
      loading: query.isLoading,
      error: query.error ? friendlyError(query.error) : null,
    }
  }

  return {
    token: {
      ...token,
      slug: known?.slug,
      verified: known?.verified ?? false,
    },
    ready: Boolean(known) || query.isSuccess,
    loading: query.isLoading && !known,
    error: !known && query.error ? friendlyError(query.error) : null,
  }
}

export function useTokenPrice(address: string | undefined) {
  return useQuery({
    queryKey: ['token-price', address?.toLowerCase() ?? 'none'],
    enabled: Boolean(address && (isNative(address) || isAddress(address))),
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: 1,
    queryFn: ({ signal }) => getTokenPrice(address ?? '', signal),
  })
}
