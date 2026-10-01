import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { isAddress } from 'viem'
import { IconSearch } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { TokenMark } from '@/components/TokenMark'
import { useHolding } from '@/hooks/useHolding'
import { useTokenPrice } from '@/hooks/useToken'
import { friendlyError, getTokenDetails } from '@/lib/api'
import { addCustomToken, readRecentTokens } from '@/lib/storage'
import { findKnown, sameToken, TOKENS } from '@/lib/tokens'
import type { TokenInfo } from '@/lib/types'
import { amountToUsd, formatTokenAmount, formatUsd, shortAddress } from '@/lib/format'

export function TokenDialog({
  title,
  tokens,
  onClose,
  onSelect,
}: {
  title: string
  tokens: TokenInfo[]
  onClose: () => void
  onSelect: (token: TokenInfo) => void
}) {
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const recent = useMemo(() => {
    return readRecentTokens()
      .map((address) => tokens.find((token) => sameToken(token.address, address)) ?? findKnown(address))
      .filter((token): token is TokenInfo => Boolean(token))
      .slice(0, 6)
  }, [tokens])

  const filtered = useMemo(() => {
    if (!query) return tokens
    return tokens.filter((token) => {
      return (
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.address.toLowerCase().includes(query)
      )
    })
  }, [query, tokens])

  const pasted = search.trim()
  const showImport = isAddress(pasted) && !tokens.some((token) => sameToken(token.address, pasted))

  function choose(token: TokenInfo) {
    onSelect(token)
    onClose()
  }

  return (
    <Modal title={title} description="Search the list or paste a Base contract." onClose={onClose} wide>
      <div className="px-5 pb-5">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3">
          <IconSearch className="size-4 text-muted" />
          <input
            autoFocus
            data-initial-focus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && filtered[0] && !showImport) {
                event.preventDefault()
                choose(filtered[0])
              }
            }}
            placeholder="Name, symbol, or address"
            aria-label="Search tokens"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </div>

        {!query && recent.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {recent.map((token) => (
              <button
                key={token.address}
                type="button"
                onClick={() => choose(token)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pr-3 pl-1 text-sm hover:bg-white/8"
              >
                <TokenMark address={token.address} symbol={token.symbol} size={22} />
                {token.symbol}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-4 max-h-[50dvh] space-y-1 overflow-y-auto overscroll-contain pr-1">
          {showImport ? <ImportRow address={pasted} onSelect={choose} /> : null}
          {filtered.map((token) => (
            <TokenRow key={token.address} token={token} onSelect={() => choose(token)} />
          ))}
          {!showImport && filtered.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted">No token matches that search.</p>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}

function TokenRow({ token, onSelect }: { token: TokenInfo; onSelect: () => void }) {
  const { address } = useAccount()
  const balance = useHolding(address, token.address)
  const price = useTokenPrice(token.address)
  const usd =
    balance.value != null && price.data != null ? amountToUsd(balance.value, token.decimals, price.data) : null

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-white/6"
    >
      <TokenMark address={token.address} symbol={token.symbol} size={36} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-medium">{token.symbol}</span>
          {token.verified ? <span className="text-[10px] tracking-wide text-muted uppercase">Listed</span> : null}
        </span>
        <span className="block truncate text-sm text-muted">{token.name}</span>
      </span>
      {address ? (
        <span className="text-right">
          <span className="block text-sm font-medium tabular-nums">
            {balance.isLoading || balance.value == null ? '…' : formatTokenAmount(balance.value, token.decimals)}
          </span>
          <span className="block text-xs text-muted tabular-nums">{price.isLoading ? '' : formatUsd(usd)}</span>
        </span>
      ) : null}
    </button>
  )
}

function ImportRow({ address, onSelect }: { address: string; onSelect: (token: TokenInfo) => void }) {
  const details = useQuery({
    queryKey: ['token-details', address.toLowerCase()],
    queryFn: ({ signal }) => getTokenDetails(address, signal),
    retry: 1,
  })

  return (
    <div className="mb-2 rounded-2xl border border-warn/30 bg-warn/8 p-3">
      <p className="text-xs leading-5 text-warn">
        Anyone can deploy a token with any name. Confirm this contract is the one you expect before you import it.
      </p>
      {details.isLoading ? <p className="mt-2 text-sm text-muted">Looking up {shortAddress(address, 6)}…</p> : null}
      {details.error ? (
        <p role="alert" className="mt-2 text-sm text-bad">
          {friendlyError(details.error)}
        </p>
      ) : null}
      {details.data ? (
        <button
          type="button"
          onClick={() => {
            if (!details.data) return
            const token = { ...details.data, verified: false }
            addCustomToken(token)
            onSelect(token)
          }}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-black/20 px-2 py-2 text-left hover:bg-black/30"
        >
          <TokenMark address={details.data.address} symbol={details.data.symbol} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Import {details.data.symbol}</span>
            <span className="block truncate text-sm text-muted">{details.data.name}</span>
          </span>
          <span className="text-xs text-muted">{details.data.decimals} decimals</span>
        </button>
      ) : null}
    </div>
  )
}

export function listedTokens(custom: TokenInfo[]): TokenInfo[] {
  const map = new Map<string, TokenInfo>()
  for (const token of [...custom, ...TOKENS]) map.set(token.address.toLowerCase(), token)
  return [...map.values()]
}
