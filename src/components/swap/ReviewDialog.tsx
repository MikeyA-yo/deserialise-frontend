import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePublicClient, useSendTransaction, useWalletClient } from 'wagmi'
import { base } from 'wagmi/chains'
import { formatUnits } from 'viem'
import { Modal } from '@/components/Modal'
import { TokenMark } from '@/components/TokenMark'
import { useTokenPrice } from '@/hooks/useToken'
import { buildSwap, friendlyError, getQuote, partnerFeesFromEnv } from '@/lib/api'
import { BASESCAN, NATIVE_ETH, QUOTE_STALE_MS } from '@/lib/constants'
import {
  amountToUsd,
  applySlippage,
  executionRate,
  formatFeeTier,
  formatRate,
  formatTokenAmount,
  formatUnitsTrim,
  formatUsd,
  priceImpact,
  shortAddress,
} from '@/lib/format'
import { pushActivity } from '@/lib/storage'
import { dexLabel, findKnown, isNative } from '@/lib/tokens'
import type { QuoteResult, SwapTransaction, TokenInfo } from '@/lib/types'

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; label: string; hash?: `0x${string}` }
  | { kind: 'error'; message: string }
  | { kind: 'success'; hash: `0x${string}`; amountOut: string }

export function ReviewDialog({
  quote,
  quotedAt,
  amountIn,
  sell,
  buy,
  slippage,
  account,
  onClose,
}: {
  quote: QuoteResult
  quotedAt: number
  amountIn: bigint
  sell: TokenInfo
  buy: TokenInfo
  slippage: number
  account: `0x${string}`
  onClose: () => void
}) {
  const [live, setLive] = useState(quote)
  const [liveAt, setLiveAt] = useState(quotedAt)
  const [notice, setNotice] = useState<string | null>(null)
  const [ackImpact, setAckImpact] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [preview, setPreview] = useState<SwapTransaction[] | null>(null)
  const [previewState, setPreviewState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [networkFee, setNetworkFee] = useState<bigint | null>(null)
  const [adding, setAdding] = useState(false)

  const queryClient = useQueryClient()
  const publicClient = usePublicClient({ chainId: base.id })
  const { sendTransactionAsync } = useSendTransaction()
  const walletClient = useWalletClient({ chainId: base.id })
  const sellPrice = useTokenPrice(sell.address)
  const buyPrice = useTokenPrice(buy.address)
  const ethPrice = useTokenPrice(NATIVE_ETH)
  const partnerFee = useMemo(() => partnerFeesFromEnv(), [])

  const out = BigInt(live.quote.amountOut)
  const usdIn = amountToUsd(amountIn, sell.decimals, sellPrice.data ?? null)
  const usdOut = amountToUsd(out, buy.decimals, buyPrice.data ?? null)
  const impact = priceImpact(usdIn, usdOut)
  const highImpact = impact != null && impact >= 5
  const minimum = applySlippage(live.quote.amountOut, slippage)
  const rate = executionRate(amountIn, out, sell.decimals, buy.decimals)
  const locked = status.kind === 'working'
  const needsApproval = preview?.some((tx) => tx.kind === 'approve') ?? false

  useEffect(() => {
    let cancelled = false
    async function previewSwap() {
      if (!publicClient) return
      setPreviewState('loading')
      try {
        const txs = await buildSwap({
          publicKey: account,
          quote: live.raw,
          slippage,
          sellToken: sell.address,
          partnerFees: partnerFee,
        })
        if (cancelled) return
        setPreview(txs)
        setPreviewState('ready')
        try {
          const fees = await publicClient.estimateFeesPerGas()
          const unit = fees.maxFeePerGas ?? fees.gasPrice ?? 0n
          let total = 0n
          for (const tx of txs) {
            const gas = await publicClient.estimateGas({
              account,
              to: tx.to,
              data: tx.data,
              value: tx.value,
            })
            total += gas * unit
          }
          if (!cancelled) setNetworkFee(total)
        } catch {
          if (!cancelled) setNetworkFee(null)
        }
      } catch {
        if (!cancelled) {
          setPreview(null)
          setPreviewState('failed')
          setNetworkFee(null)
        }
      }
    }
    void previewSwap()
    return () => {
      cancelled = true
    }
  }, [account, live, partnerFee, publicClient, sell.address, slippage])

  async function confirm() {
    if (!publicClient || locked) return
    if (highImpact && !ackImpact) return
    setNotice(null)
    setStatus({ kind: 'working', label: 'Checking the latest price…' })
    try {
      let nextQuote = live
      const age = Date.now() - liveAt
      if (age > QUOTE_STALE_MS) {
        const fresh = await getQuote({
          tokenA: sell.address,
          tokenB: buy.address,
          amountIn: amountIn.toString(),
        })
        const shown = BigInt(live.quote.amountOut)
        const next = BigInt(fresh.quote.amountOut)
        if (shown > 0n && next * 10_000n < shown * 9_950n) {
          setLive(fresh)
          setLiveAt(Date.now())
          setStatus({ kind: 'idle' })
          setNotice('The price moved. Review the new amount, then confirm again.')
          return
        }
        nextQuote = fresh
        setLive(fresh)
        setLiveAt(Date.now())
      }

      setStatus({ kind: 'working', label: 'Preparing the transaction…' })
      const txs = await buildSwap({
        publicKey: account,
        quote: nextQuote.raw,
        slippage,
        sellToken: sell.address,
        partnerFees: partnerFee,
      })

      let hash: `0x${string}` | null = null
      for (let index = 0; index < txs.length; index += 1) {
        const tx = txs[index]
        if (!tx) continue
        const step = txs.length > 1 ? `Step ${index + 1} of ${txs.length}. ` : ''
        setStatus({
          kind: 'working',
          label:
            tx.kind === 'approve'
              ? `${step}Approve ${sell.symbol} in your wallet.`
              : `${step}Confirm the swap in your wallet.`,
        })
        hash = await sendTransactionAsync({
          to: tx.to,
          data: tx.data,
          value: tx.value,
          chainId: base.id,
        })
        setStatus({
          kind: 'working',
          label: tx.kind === 'approve' ? 'Waiting for the approval to confirm…' : 'Waiting for the swap to confirm…',
          hash,
        })
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (receipt.status !== 'success') {
          throw new Error(tx.kind === 'approve' ? 'The approval reverted.' : 'The swap reverted.')
        }
      }
      if (!hash) throw new Error('The wallet did not return a transaction.')

      await queryClient.invalidateQueries()
      pushActivity({
        id: hash,
        hash,
        sellSymbol: sell.symbol,
        buySymbol: buy.symbol,
        sellAddress: sell.address,
        buyAddress: buy.address,
        amountIn: formatUnits(amountIn, sell.decimals),
        amountOut: formatUnits(BigInt(nextQuote.quote.amountOut), buy.decimals),
        timestamp: Date.now(),
      })
      setStatus({ kind: 'success', hash, amountOut: nextQuote.quote.amountOut })
    } catch (error) {
      setStatus({ kind: 'error', message: friendlyError(error) })
    }
  }

  async function addToken() {
    if (isNative(buy.address) || !walletClient.data) return
    setAdding(true)
    try {
      await walletClient.data.watchAsset({
        type: 'ERC20',
        options: {
          address: buy.address as `0x${string}`,
          symbol: buy.symbol,
          decimals: buy.decimals,
        },
      })
    } catch {
      // The wallet can reject the asset prompt. The swap itself already succeeded.
    } finally {
      setAdding(false)
    }
  }

  if (status.kind === 'success') {
    return (
      <Modal title="Swap confirmed" onClose={onClose}>
        <div className="px-5 pt-2 pb-5">
          <div className="rounded-3xl bg-white/5 px-4 py-5 text-center">
            <p className="text-sm text-muted">You received</p>
            <p className="mt-1 text-3xl font-medium tracking-tight tabular-nums">
              {formatUnitsTrim(BigInt(status.amountOut), buy.decimals)} {buy.symbol}
            </p>
            <p className="mt-2 text-sm text-muted">
              for {formatUnitsTrim(amountIn, sell.decimals)} {sell.symbol}
            </p>
          </div>
          <div className="mt-4 grid gap-2">
            <a
              href={`${BASESCAN}/tx/${status.hash}`}
              target="_blank"
              rel="noreferrer"
              className="grid h-12 place-items-center rounded-2xl bg-accent text-sm font-semibold text-accent-ink"
            >
              View on BaseScan
            </a>
            {!isNative(buy.address) ? (
              <button
                type="button"
                onClick={() => void addToken()}
                disabled={adding || !walletClient.data}
                className="h-12 rounded-2xl bg-white/6 text-sm font-medium hover:bg-white/10 disabled:opacity-40"
              >
                {adding ? 'Waiting for wallet…' : `Add ${buy.symbol} to wallet`}
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="h-12 rounded-2xl text-sm text-muted hover:text-ink">
              Done
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  const confirmLabel =
    status.kind === 'working'
      ? status.label
      : needsApproval
        ? 'Approve and swap'
        : 'Confirm swap'

  return (
    <Modal title="Review swap" description="You sign this directly in your wallet." onClose={onClose} locked={locked}>
      <div className="px-5 pt-1 pb-5">
        <AmountRow token={sell} amount={formatUnitsTrim(amountIn, sell.decimals)} usd={usdIn} caption="You pay" />
        <div className="my-2 flex justify-center text-muted" aria-hidden="true">
          ↓
        </div>
        <AmountRow token={buy} amount={formatUnitsTrim(out, buy.decimals)} usd={usdOut} caption="You receive" />

        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Rate" value={rate ? `1 ${sell.symbol} = ${formatRate(rate)} ${buy.symbol}` : '—'} />
          <Row
            label="Minimum received"
            value={`${formatUnitsTrim(minimum, buy.decimals)} ${buy.symbol}`}
          />
          <Row
            label="Price impact"
            value={impact == null ? '—' : impact < 0 ? `${Math.abs(impact).toFixed(2)}% surplus` : `${impact.toFixed(2)}%`}
            tone={impact == null ? 'muted' : impact >= 5 ? 'bad' : impact >= 1 ? 'warn' : 'good'}
          />
          <Row label="Slippage" value={`${slippage}%`} />
          <Row label="Route" value={<RouteText quote={live} sell={sell} buy={buy} />} />
          <Row
            label="Network fee"
            value={
              networkFee == null
                ? previewState === 'loading'
                  ? 'Estimating…'
                  : 'Shown in your wallet'
                : formatFee(networkFee, ethPrice.data ?? null)
            }
          />
          {partnerFee ? (
            <Row label="Interface fee" value={`${partnerFee.fee}% · ${shortAddress(partnerFee.recipient)}`} />
          ) : null}
        </dl>

        {previewState === 'ready' && needsApproval ? (
          <p className="mt-3 text-xs leading-5 text-muted">
            {sell.symbol} needs a one-time approval for this amount before the swap can be sent.
          </p>
        ) : null}
        {highImpact ? (
          <label className="mt-3 flex items-start gap-3 rounded-2xl border border-bad/30 bg-bad/10 px-3 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={ackImpact}
              onChange={(event) => setAckImpact(event.target.checked)}
            />
            <span>This trade moves the price by {impact?.toFixed(2)}%. I understand I may receive much less value.</span>
          </label>
        ) : null}
        {notice ? (
          <p role="status" className="mt-3 text-sm text-warn">
            {notice}
          </p>
        ) : null}
        {status.kind === 'error' ? (
          <p role="alert" className="mt-3 text-sm text-bad">
            {status.message}
          </p>
        ) : null}
        {status.kind === 'working' && status.hash ? (
          <a
            href={`${BASESCAN}/tx/${status.hash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block text-sm text-muted underline decoration-white/20 underline-offset-2"
          >
            View transaction
          </a>
        ) : null}

        <button
          type="button"
          data-initial-focus
          onClick={() => void confirm()}
          disabled={locked || (highImpact && !ackImpact)}
          className="mt-4 grid min-h-14 w-full place-items-center rounded-2xl bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

function AmountRow({
  token,
  amount,
  usd,
  caption,
}: {
  token: TokenInfo
  amount: string
  usd: number | null
  caption: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-3">
      <div>
        <p className="text-xs text-muted">{caption}</p>
        <p className="text-xl font-medium tracking-tight tabular-nums">
          {amount} {token.symbol}
        </p>
        <p className="text-xs text-muted tabular-nums">{formatUsd(usd)}</p>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full bg-black/20 py-1 pr-3 pl-1">
        <TokenMark address={token.address} symbol={token.symbol} size={28} />
        <span className="text-sm font-medium">{token.symbol}</span>
      </span>
    </div>
  )
}

function Row({
  label,
  value,
  tone = 'ink',
}: {
  label: string
  value: string | ReactNode
  tone?: 'ink' | 'muted' | 'good' | 'warn' | 'bad'
}) {
  const toneClass = {
    ink: 'text-ink',
    muted: 'text-muted',
    good: 'text-good',
    warn: 'text-warn',
    bad: 'text-bad',
  }[tone]
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={`max-w-[65%] text-right ${toneClass}`}>{value}</dd>
    </div>
  )
}

function RouteText({ quote, sell, buy }: { quote: QuoteResult; sell: TokenInfo; buy: TokenInfo }) {
  const hops = quote.quote.routePlan
  if (hops.length === 0) return <span>Direct</span>
  const symbols = [labelFor(hops[0]?.tokenA ?? sell.address, sell, buy)]
  for (const hop of hops) symbols.push(labelFor(hop.tokenB, sell, buy))
  const venues = [...new Set(hops.map((hop) => dexLabel(hop.dexId)))]
  const fees = [...new Set(hops.map((hop) => formatFeeTier(hop.fee)))]
  return (
    <span>
      <span className="block">{symbols.join(' → ')}</span>
      <span className="block text-xs text-muted">
        {venues.join(', ')} · {fees.join(', ')}
      </span>
    </span>
  )
}

function labelFor(address: string, sell: TokenInfo, buy: TokenInfo): string {
  if (isNative(address)) return 'ETH'
  if (address.toLowerCase() === sell.address.toLowerCase()) return sell.symbol
  if (address.toLowerCase() === buy.address.toLowerCase()) return buy.symbol
  return findKnown(address)?.symbol ?? shortAddress(address)
}

function formatFee(wei: bigint, ethUsd: number | null): string {
  const eth = formatTokenAmount(wei, 18)
  if (ethUsd == null) return `${eth} ETH`
  const usd = Number(formatUnits(wei, 18)) * ethUsd
  return `${eth} ETH · ${formatUsd(usd)}`
}
