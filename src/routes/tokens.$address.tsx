import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SwapCard } from '@/components/swap/SwapCard'
import { TokenMark } from '@/components/TokenMark'
import { useTitle } from '@/hooks/useTitle'
import { useToken, useTokenPrice } from '@/hooks/useToken'
import { BASESCAN, NATIVE_ETH } from '@/lib/constants'
import { formatPrice, shortAddress } from '@/lib/format'
import { findKnown, isNative, parseTokenRoute, sameToken } from '@/lib/tokens'

export const Route = createFileRoute('/tokens/$address')({
  component: TokenPage,
})

function TokenPage() {
  const { address: raw } = Route.useParams()
  const resolved = parseTokenRoute(decodeURIComponent(raw))
  useTitle(resolved ? 'Token · Deserialize' : 'Token not found · Deserialize')

  if (!resolved) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Token not found</h1>
        <p className="mt-2 text-sm text-muted">That address isn’t a valid Base token reference.</p>
        <Link to="/explore" className="mt-6 inline-flex text-sm text-accent hover:underline">
          Back to explore
        </Link>
      </div>
    )
  }

  return <TokenBody address={resolved} />
}

function TokenBody({ address }: { address: string }) {
  const meta = useToken(address)
  const price = useTokenPrice(address)
  const known = findKnown(address)
  const [copied, setCopied] = useState(false)
  const [pair, setPair] = useState(() => initialPair(address))

  useTitle(`${meta.token.symbol} · Deserialize`)

  useEffect(() => {
    setPair(initialPair(address))
  }, [address])

  const explorer = isNative(address) ? `${BASESCAN}/address/${'0x4200000000000000000000000000000000000006'}` : `${BASESCAN}/token/${address}`

  return (
    <div className="grid min-w-0 items-start gap-8 pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <section>
        <Link to="/explore" className="text-sm text-muted hover:text-ink">
          ← Explore
        </Link>
        <div className="mt-4 flex items-center gap-4">
          <TokenMark address={address} symbol={meta.token.symbol} size={56} />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{meta.token.symbol}</h1>
            <p className="text-muted">{meta.token.name}</p>
          </div>
        </div>
        <p className="mt-6 text-4xl font-medium tracking-tight tabular-nums">
          {price.isLoading ? '…' : formatPrice(price.data)}
        </p>
        <p className="mt-1 text-sm text-muted">USD price from the aggregator</p>

        {!known ? (
          <p className="mt-6 rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
            This token isn’t in the curated list. Confirm the contract before you trade it.
          </p>
        ) : null}
        {meta.error ? (
          <p role="alert" className="mt-4 text-sm text-bad">
            {meta.error}
          </p>
        ) : null}

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex items-center gap-4">
            <dt className="w-24 shrink-0 text-muted">Contract</dt>
            <dd className="inline-flex items-center gap-2 font-mono">
              {isNative(address) ? 'Native ETH' : shortAddress(address, 6)}
              <button
                type="button"
                className="text-xs text-muted hover:text-ink"
                onClick={async () => {
                  await navigator.clipboard.writeText(isNative(address) ? address : address)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1200)
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </dd>
          </div>
          <div className="flex items-center gap-4">
            <dt className="w-24 shrink-0 text-muted">Decimals</dt>
            <dd className="tabular-nums">{meta.ready ? meta.token.decimals : '…'}</dd>
          </div>
          <div className="flex items-center gap-4">
            <dt className="w-24 shrink-0 text-muted">Network</dt>
            <dd>Base</dd>
          </div>
        </dl>
        <a
          href={explorer}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex text-sm text-muted underline decoration-white/20 underline-offset-2 hover:text-ink"
        >
          View on BaseScan
        </a>
      </section>
      <SwapCard sell={pair.sell} buy={pair.buy} onChange={setPair} />
    </div>
  )
}

function initialPair(address: string): { sell: string; buy: string } {
  const usdc = findKnown('usdc')?.address ?? NATIVE_ETH
  if (sameToken(address, NATIVE_ETH)) return { sell: usdc, buy: address }
  return { sell: NATIVE_ETH, buy: address }
}
