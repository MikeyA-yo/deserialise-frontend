import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueries, useQuery } from '@tanstack/react-query'
import { isAddress } from 'viem'
import { TokenMark } from '@/components/TokenMark'
import { useTitle } from '@/hooks/useTitle'
import {
  friendlyError,
  getAllTokens,
  getTokenDetails,
  getTokenMarkets,
  getTrendingTokens,
  type ListedToken,
  type TokenMarket,
} from '@/lib/api'
import { WETH } from '@/lib/constants'
import { formatCompactUsd, formatPercent, formatPrice, shortAddress } from '@/lib/format'
import { findKnown, isNative, TOKENS } from '@/lib/tokens'
import type { TokenInfo } from '@/lib/types'

export const Route = createFileRoute('/explore')({
  component: ExplorePage,
})

const PAGE_SIZE = 50
/** Matches the aggregator's 5-minute market cache: refetching sooner would return the same data */
const MARKET_STALE_MS = 5 * 60 * 1000
const KEEP_MS = 30 * 60 * 1000

type Tab = 'all' | 'trending'

/** Market data is keyed by ERC-20 address; native ETH uses WETH's */
function marketKey(address: string): string {
  return (isNative(address) ? WETH : address).toLowerCase()
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

/** Exact symbol, then symbol prefix, then symbol substring, then name/address */
function rank(token: TokenInfo, query: string): number {
  const symbol = token.symbol.toLowerCase()
  if (symbol === query || token.address.toLowerCase() === query) return 0
  if (symbol.startsWith(query)) return 1
  if (symbol.includes(query)) return 2
  if (token.name.toLowerCase().includes(query) || token.address.toLowerCase().startsWith(query)) return 3
  return -1
}

function ExplorePage() {
  useTitle('Explore · Deserialize')
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const query = useDebounced(search.trim().toLowerCase(), 250)
  const pasted = isAddress(search.trim())

  useEffect(() => setVisible(PAGE_SIZE), [query, tab])

  const lookup = useQuery({
    queryKey: ['token-details', search.trim().toLowerCase()],
    enabled: pasted,
    queryFn: ({ signal }) => getTokenDetails(search.trim(), signal),
    retry: 1,
  })

  const allTokens = useQuery({
    queryKey: ['all-tokens'],
    queryFn: ({ signal }) => getAllTokens(signal),
    staleTime: MARKET_STALE_MS,
    gcTime: KEEP_MS,
    retry: 1,
  })

  // Built-in tokens first (they carry slugs and native ETH), then the aggregator's full list
  const listed = useMemo<ListedToken[]>(() => {
    const map = new Map<string, ListedToken>()
    for (const token of TOKENS) map.set(token.address.toLowerCase(), token)
    for (const token of allTokens.data ?? []) {
      const key = token.address.toLowerCase()
      const builtIn = map.get(key)
      map.set(key, builtIn ? { ...token, ...builtIn, logoURI: token.logoURI, indexed: token.indexed } : token)
    }
    return [...map.values()]
  }, [allTokens.data])

  const filtered = useMemo(() => {
    if (!query || pasted) return listed
    return listed
      .map((token) => ({ token, score: rank(token, query) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => a.score - b.score)
      .map((entry) => entry.token)
  }, [listed, query, pasted])

  const shown = filtered.slice(0, visible)

  // One market request per page of PAGE_SIZE rows; each page is cached for 5 minutes
  const pages = useMemo(() => {
    const keys = shown.map((token) => marketKey(token.address))
    const out: string[][] = []
    for (let i = 0; i < keys.length; i += PAGE_SIZE) out.push(keys.slice(i, i + PAGE_SIZE))
    return out
  }, [shown])

  const marketPages = useQueries({
    queries: pages.map((addresses) => ({
      queryKey: ['token-markets', addresses.join(',')],
      queryFn: ({ signal }: { signal: AbortSignal }) => getTokenMarkets(addresses, signal),
      enabled: tab === 'all',
      staleTime: MARKET_STALE_MS,
      gcTime: KEEP_MS,
      retry: 1,
    })),
  })
  const markets = useMemo(() => {
    const merged: Record<string, TokenMarket | null> = {}
    for (const page of marketPages) Object.assign(merged, page.data ?? {})
    return merged
  }, [marketPages])
  const marketsLoading = marketPages.some((page) => page.isLoading)

  const trending = useQuery({
    queryKey: ['trending-tokens'],
    enabled: tab === 'trending',
    queryFn: ({ signal }) => getTrendingTokens(signal),
    staleTime: MARKET_STALE_MS,
    gcTime: KEEP_MS,
    retry: 1,
  })

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Explore</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        Prices for tokens on Base. Search by name or symbol, or paste any contract address to open it.
      </p>

      <div className="mt-6 flex gap-2" role="tablist" aria-label="Token lists">
        {(['all', 'trending'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`h-9 rounded-full px-4 text-sm font-medium ${
              tab === value ? 'bg-white/12 text-white' : 'text-muted hover:bg-white/6'
            }`}
          >
            {value === 'all' ? 'All tokens' : 'Trending'}
          </button>
        ))}
      </div>

      {tab === 'all' ? (
        <>
          <label className="mt-4 block">
            <span className="sr-only">Search tokens</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or paste an address"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="h-12 w-full rounded-2xl border border-white/10 bg-surface px-4 text-sm outline-none placeholder:text-muted"
            />
          </label>

          {pasted ? (
            <div className="mt-4">
              {lookup.isLoading ? <p className="text-sm text-muted">Looking up {shortAddress(search.trim(), 6)}…</p> : null}
              {lookup.error ? (
                <p role="alert" className="text-sm text-bad">
                  {friendlyError(lookup.error)}
                </p>
              ) : null}
              {lookup.data ? (
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-surface">
                  <TokenRow token={lookup.data} />
                </div>
              ) : null}
            </div>
          ) : null}

          {!pasted ? (
            <>
              <p className="mt-4 text-xs text-muted">
                {allTokens.isLoading
                  ? 'Loading the token list…'
                  : allTokens.error
                    ? 'Showing popular tokens only: the full list could not be loaded.'
                    : `${filtered.length.toLocaleString()} token${filtered.length === 1 ? '' : 's'}${query ? ' match' : ''}`}
              </p>
              <ul className="mt-2 divide-y divide-white/8 overflow-hidden rounded-3xl border border-white/10 bg-surface">
                {shown.map((token) => (
                  <li key={token.address}>
                    <TokenRow
                      token={token}
                      logoURI={token.logoURI ?? markets[marketKey(token.address)]?.logoURI}
                      market={markets[marketKey(token.address)]}
                      marketLoading={marketsLoading && !(marketKey(token.address) in markets)}
                    />
                  </li>
                ))}
                {shown.length === 0 ? (
                  <li className="px-4 py-8 text-center text-sm text-muted">No token matches.</li>
                ) : null}
              </ul>
              {filtered.length > shown.length ? (
                <button
                  type="button"
                  onClick={() => setVisible((count) => count + PAGE_SIZE)}
                  className="mt-4 h-11 w-full rounded-2xl border border-white/10 text-sm font-medium hover:bg-white/4"
                >
                  Show more ({(filtered.length - shown.length).toLocaleString()} left)
                </button>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-4 text-xs text-muted">Tokens in Base&apos;s most active pools right now. Updated every 5 minutes.</p>
          {trending.isLoading ? <p className="mt-2 text-sm text-muted">Loading trending tokens…</p> : null}
          {trending.error ? (
            <p role="alert" className="mt-2 text-sm text-bad">
              {friendlyError(trending.error)}
            </p>
          ) : null}
          <ul className="mt-2 divide-y divide-white/8 overflow-hidden rounded-3xl border border-white/10 bg-surface">
            {(trending.data ?? []).map((item) => {
              const known = findKnown(item.address)
              const token: TokenInfo = known ?? {
                address: item.address,
                symbol: item.symbol ?? shortAddress(item.address),
                name: item.name ?? item.poolName,
                decimals: item.decimals ?? 18,
              }
              return (
                <li key={item.address}>
                  <TokenRow token={token} logoURI={item.logoURI} market={item} subtitle={item.dex ?? undefined} />
                </li>
              )
            })}
            {trending.data && trending.data.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted">No trending data right now.</li>
            ) : null}
          </ul>
        </>
      )}
    </div>
  )
}

function TokenRow({
  token,
  logoURI,
  market,
  marketLoading = false,
  subtitle,
}: {
  token: TokenInfo
  logoURI?: string | null
  market?: TokenMarket | null
  marketLoading?: boolean
  subtitle?: string
}) {
  const change = market?.priceChange24h ?? null
  return (
    <Link
      to="/tokens/$address"
      params={{ address: token.slug ?? token.address }}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/4"
    >
      <TokenMark address={token.address} symbol={token.symbol} size={40} logoURI={logoURI} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{token.symbol}</span>
        <span className="block truncate text-sm text-muted">{subtitle ? `${token.name} · ${subtitle}` : token.name}</span>
      </span>
      <span className="hidden w-28 text-right sm:block">
        <span className="block text-sm tabular-nums">{formatCompactUsd(market?.marketCapUsd ?? market?.fdvUsd)}</span>
        <span className="block text-xs text-muted">Vol {formatCompactUsd(market?.volume24hUsd)}</span>
      </span>
      <span className="w-28 text-right">
        <span className="block font-medium tabular-nums">{marketLoading ? '…' : formatPrice(market?.priceUsd)}</span>
        <span
          className={`block text-xs tabular-nums ${change == null ? 'text-muted' : change >= 0 ? 'text-good' : 'text-bad'}`}
        >
          {change == null ? 'USD' : `${change >= 0 ? '+' : ''}${formatPercent(change)}`}
        </span>
      </span>
    </Link>
  )
}
