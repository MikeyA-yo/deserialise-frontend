import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { isAddress } from 'viem'
import { TokenMark } from '@/components/TokenMark'
import { useTitle } from '@/hooks/useTitle'
import { useTokenPrice } from '@/hooks/useToken'
import { friendlyError, getTokenDetails } from '@/lib/api'
import { formatPrice, shortAddress } from '@/lib/format'
import { TOKENS } from '@/lib/tokens'
import type { TokenInfo } from '@/lib/types'

export const Route = createFileRoute('/explore')({
  component: ExplorePage,
})

function ExplorePage() {
  useTitle('Explore · Deserialize')
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const pasted = isAddress(search.trim())
  const lookup = useQuery({
    queryKey: ['token-details', search.trim().toLowerCase()],
    enabled: pasted,
    queryFn: ({ signal }) => getTokenDetails(search.trim(), signal),
    retry: 1,
  })

  const filtered = TOKENS.filter((token) => {
    if (!query || pasted) return true
    return (
      token.symbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query) ||
      token.address.toLowerCase().includes(query)
    )
  })

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <h1 className="text-3xl font-semibold tracking-tight">Explore</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        Prices for tokens routed on Base. Paste any contract address to open it.
      </p>
      <label className="mt-6 block">
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
          {lookup.data ? <TokenLink token={lookup.data} /> : null}
        </div>
      ) : null}

      <ul className="mt-4 divide-y divide-white/8 overflow-hidden rounded-3xl border border-white/10 bg-surface">
        {filtered.map((token) => (
          <li key={token.address}>
            <TokenLink token={token} />
          </li>
        ))}
        {filtered.length === 0 ? <li className="px-4 py-8 text-center text-sm text-muted">No listed token matches.</li> : null}
      </ul>
    </div>
  )
}

function TokenLink({ token }: { token: TokenInfo }) {
  const price = useTokenPrice(token.address)
  return (
    <Link
      to="/tokens/$address"
      params={{ address: token.slug ?? token.address }}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/4"
    >
      <TokenMark address={token.address} symbol={token.symbol} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{token.symbol}</span>
        <span className="block truncate text-sm text-muted">{token.name}</span>
      </span>
      <span className="text-right">
        <span className="block font-medium tabular-nums">{price.isLoading ? '…' : formatPrice(price.data)}</span>
        <span className="block text-xs text-muted">USD</span>
      </span>
    </Link>
  )
}
