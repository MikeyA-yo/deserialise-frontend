import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { base } from 'wagmi/chains'
import { formatUnits } from 'viem'
import { IconArrowDown, IconChevron } from '@/components/icons'
import { SettingsMenu } from '@/components/swap/SettingsMenu'
import { listedTokens, TokenDialog } from '@/components/swap/TokenDialog'
import { ReviewDialog } from '@/components/swap/ReviewDialog'
import { TokenMark } from '@/components/TokenMark'
import { useOpenWallet } from '@/components/wallet'
import { useSwapQuote } from '@/hooks/useQuote'
import { useCustomTokens, useToken, useTokenPrice } from '@/hooks/useToken'
import { friendlyError, partnerFeesFromEnv, toBigInt } from '@/lib/api'
import { GAS_RESERVE, NATIVE_ETH, QUOTE_DEBOUNCE_MS } from '@/lib/constants'
import { cn } from '@/lib/cn'
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
  sanitizeAmount,
  shortAddress,
  tryParseAmount,
} from '@/lib/format'
import { readSettings, rememberToken, writeSettings } from '@/lib/storage'
import { describeSwap } from '@/lib/swap-intent'
import { dexLabel, findKnown, isEthFamily, isNative, sameToken } from '@/lib/tokens'
import type { QuoteResult, TokenInfo } from '@/lib/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useHolding } from '@/hooks/useHolding'

type Side = 'sell' | 'buy'

export function SwapCard({
  sell,
  buy,
  onChange,
}: {
  sell: string
  buy: string
  onChange: (next: { sell: string; buy: string }) => void
}) {
  const [sellAmount, setSellAmount] = useState('')
  const [buyAmount, setBuyAmount] = useState('')
  const [mode, setMode] = useState<'exactIn' | 'exactOut'>('exactIn')
  const [picking, setPicking] = useState<Side | null>(null)
  const [slippage, setSlippage] = useState(() => readSettings().slippage)
  const [inverted, setInverted] = useState(false)
  const [turns, setTurns] = useState(0)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [review, setReview] = useState<{ quote: QuoteResult; quotedAt: number; amountIn: bigint } | null>(null)

  const openWallet = useOpenWallet()
  const { address, isConnected, chainId } = useAccount()
  const { switchChain, isPending: switching } = useSwitchChain()
  const customTokens = useCustomTokens()
  const catalog = useMemo(() => listedTokens(customTokens), [customTokens])

  const sellMeta = useToken(sell)
  const buyMeta = useToken(buy)
  const sellPrice = useTokenPrice(sellMeta.ready ? sell : undefined)
  const buyPrice = useTokenPrice(buyMeta.ready ? buy : undefined)
  const sellBalance = useHolding(address, sellMeta.ready ? sell : undefined)
  const buyBalance = useHolding(address, buyMeta.ready ? buy : undefined)

  // Debouncing based on active input mode
  const debouncedSell = useDebouncedValue(sellAmount, QUOTE_DEBOUNCE_MS)
  const debouncedBuy = useDebouncedValue(buyAmount, QUOTE_DEBOUNCE_MS)

  const parsedSell = sellMeta.ready ? tryParseAmount(sellAmount, sellMeta.token.decimals) : null
  const parsedBuy = buyMeta.ready ? tryParseAmount(buyAmount, buyMeta.token.decimals) : null
  const debouncedParsedSell = sellMeta.ready ? tryParseAmount(debouncedSell, sellMeta.token.decimals) : null
  const debouncedParsedBuy = buyMeta.ready ? tryParseAmount(debouncedBuy, buyMeta.token.decimals) : null

  const same = sameToken(sell, buy)
  const ethWrap = isEthFamily(sell) && isEthFamily(buy)

  const activeQuoteAmount = useMemo(() => {
    if (mode === 'exactIn') {
      return debouncedParsedSell && debouncedParsedSell > 0n ? debouncedParsedSell.toString() : null
    }
    return debouncedParsedBuy && debouncedParsedBuy > 0n ? debouncedParsedBuy.toString() : null
  }, [mode, debouncedParsedSell, debouncedParsedBuy])

  const quote = useSwapQuote({
    sell,
    buy,
    mode,
    amount: activeQuoteAmount,
    decimalsA: sellMeta.token.decimals,
    decimalsB: buyMeta.token.decimals,
    priceA: sellPrice.data,
    priceB: buyPrice.data,
    enabled: sellMeta.ready && buyMeta.ready && !same && !ethWrap && activeQuoteAmount != null,
  })

  const visible = quote.data ?? null
  const amountInFromQuote = visible ? toBigInt(visible.quote.amountIn) : null
  const amountOutFromQuote = visible ? toBigInt(visible.quote.amountOut) : null

  const synced = Boolean(
    visible &&
      ((mode === 'exactIn' && parsedSell && parsedSell > 0n && amountInFromQuote === parsedSell) ||
        (mode === 'exactOut' && parsedBuy && parsedBuy > 0n && amountOutFromQuote && amountOutFromQuote >= (parsedBuy * 99n) / 100n)),
  )

  const isDebouncing =
    mode === 'exactIn'
      ? Boolean(parsedSell && parsedSell > 0n && sellAmount !== debouncedSell)
      : Boolean(parsedBuy && parsedBuy > 0n && buyAmount !== debouncedBuy)

  const pendingQuote = Boolean(
    (mode === 'exactIn' ? parsedSell && parsedSell > 0n : parsedBuy && parsedBuy > 0n) &&
      !synced &&
      !same &&
      !ethWrap &&
      sellMeta.ready &&
      buyMeta.ready &&
      !quote.isError &&
      (isDebouncing || quote.isFetching || quote.isPending),
  )

  const hardError = ethWrap
    ? 'Direct swaps between ETH and WETH are not available via DEX pools. Select another token.'
    : !synced && quote.isError
      ? friendlyError(quote.error)
      : null

  const refreshWarning = synced && quote.isError ? 'Couldn’t refresh the price. This is the last quote.' : null

  // Auto-populate the opposite field when quote arrives
  useEffect(() => {
    if (!visible || !synced) return
    if (mode === 'exactIn' && amountOutFromQuote != null && amountOutFromQuote > 0n) {
      setBuyAmount(formatUnitsTrim(amountOutFromQuote, buyMeta.token.decimals))
    } else if (mode === 'exactOut' && amountInFromQuote != null && amountInFromQuote > 0n) {
      setSellAmount(formatUnitsTrim(amountInFromQuote, sellMeta.token.decimals))
    }
  }, [visible, synced, mode, amountInFromQuote, amountOutFromQuote, buyMeta.token.decimals, sellMeta.token.decimals])

  // Effective BigInt values for review and USD
  const effectiveSellBigInt = mode === 'exactIn' ? parsedSell : (amountInFromQuote ?? null)
  const effectiveBuyBigInt = mode === 'exactOut' ? parsedBuy : (amountOutFromQuote ?? null)

  const usdIn = amountToUsd(effectiveSellBigInt, sellMeta.token.decimals, sellPrice.data ?? null)
  const usdOut = amountToUsd(effectiveBuyBigInt, buyMeta.token.decimals, buyPrice.data ?? null)
  const impact = synced ? priceImpact(usdIn, usdOut) : null
  const partnerFee = partnerFeesFromEnv()
  const wrongChain = Boolean(isConnected && chainId !== base.id)

  const intent = describeSwap({
    connected: Boolean(isConnected && address),
    wrongChain,
    amount: effectiveSellBigInt,
    sameToken: same,
    ethWrap,
    pendingQuote,
    quoteError: hardError,
    hasQuote: synced,
    balance: sellBalance.value,
    balanceLoading: Boolean(isConnected && sellMeta.ready && sellBalance.isLoading),
    symbol: sellMeta.token.symbol,
  })

  const rate =
    visible && amountInFromQuote && amountOutFromQuote
      ? executionRate(amountInFromQuote, amountOutFromQuote, sellMeta.token.decimals, buyMeta.token.decimals)
      : null
  const shownRate = rate == null ? null : inverted && rate !== 0 ? 1 / rate : rate
  const rateLabel =
    shownRate == null
      ? null
      : inverted
        ? `1 ${buyMeta.token.symbol} = ${formatRate(shownRate)} ${sellMeta.token.symbol}`
        : `1 ${sellMeta.token.symbol} = ${formatRate(shownRate)} ${buyMeta.token.symbol}`

  function updateSlippage(next: number) {
    setSlippage(next)
    writeSettings({ slippage: next })
  }

  function handleSellInput(value: string) {
    setMode('exactIn')
    const sanitized = sanitizeAmount(value, sellMeta.token.decimals)
    setSellAmount(sanitized)
    if (!sanitized) {
      setBuyAmount('')
    }
  }

  function handleBuyInput(value: string) {
    setMode('exactOut')
    const sanitized = sanitizeAmount(value, buyMeta.token.decimals)
    setBuyAmount(sanitized)
    if (!sanitized) {
      setSellAmount('')
    }
  }

  function selectToken(side: Side, token: TokenInfo) {
    rememberToken(token.address)
    const other = side === 'sell' ? buy : sell
    if (sameToken(token.address, other)) {
      flip()
      return
    }
    if (side === 'sell') {
      setSellAmount('')
      if (mode === 'exactIn') setBuyAmount('')
    } else {
      setBuyAmount('')
      if (mode === 'exactOut') setSellAmount('')
    }
    onChange(side === 'sell' ? { sell: token.address, buy } : { sell, buy: token.address })
  }

  function flip() {
    setTurns((value) => value + 1)
    if (mode === 'exactIn') {
      setMode('exactIn')
      setSellAmount(buyAmount)
      setBuyAmount('')
    } else {
      setMode('exactOut')
      setBuyAmount(sellAmount)
      setSellAmount('')
    }
    onChange({ sell: buy, buy: sell })
  }

  function fillMax() {
    if (sellBalance.value == null || !sellMeta.ready) return
    const usable = isNative(sell)
      ? sellBalance.value > GAS_RESERVE
        ? sellBalance.value - GAS_RESERVE
        : 0n
      : sellBalance.value
    setMode('exactIn')
    const val = formatUnits(usable, sellMeta.token.decimals)
    setSellAmount(val)
  }

  function onPrimary() {
    if (intent.action === 'connect') {
      openWallet()
      return
    }
    if (intent.action === 'switch') {
      switchChain({ chainId: base.id })
      return
    }
    if (intent.action === 'review' && visible && effectiveSellBigInt && address) {
      setReview({ quote: visible, quotedAt: quote.dataUpdatedAt, amountIn: effectiveSellBigInt })
    }
  }

  const multiHopBlocked = Boolean(hardError && !isEthFamily(sell) && !isEthFamily(buy))

  return (
    <section className="w-full min-w-0 rounded-[28px] border border-white/10 bg-surface/95 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between px-2 pt-1 pb-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Swap</h1>
          <p className="text-xs text-muted">Aggregated on Base</p>
        </div>
        <SettingsMenu slippage={slippage} onChange={updateSlippage} />
      </div>

      <div className="relative grid gap-1">
        <SwapInputCard
          id="sell-amount"
          label="You pay"
          amount={sellAmount}
          usd={usdIn}
          token={sellMeta.token}
          loading={sellMeta.loading}
          faded={mode === 'exactOut' && (!synced || isDebouncing || quote.isFetching)}
          onAmount={handleSellInput}
          onPick={() => setPicking('sell')}
          balance={
            isConnected
              ? sellBalance.value != null
                ? formatTokenAmount(sellBalance.value, sellMeta.token.decimals)
                : '…'
              : null
          }
          onMax={isConnected && sellBalance.value != null ? fillMax : undefined}
          maxTitle={isNative(sell) ? 'Leaves a little ETH for the network fee' : 'Use your full balance'}
        />

        <button
          type="button"
          onClick={flip}
          aria-label="Switch tokens"
          className="absolute top-1/2 left-1/2 z-10 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border border-white/10 bg-raised text-muted shadow-lg hover:text-ink active:scale-95"
          style={{ transform: `translate(-50%, -50%) rotate(${turns * 180}deg)`, transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <IconArrowDown className="size-4" />
        </button>

        <SwapInputCard
          id="buy-amount"
          label="You receive"
          amount={buyAmount}
          usd={usdOut}
          token={buyMeta.token}
          loading={buyMeta.loading}
          faded={mode === 'exactIn' && (!synced || isDebouncing || quote.isFetching)}
          onAmount={handleBuyInput}
          onPick={() => setPicking('buy')}
          balance={
            isConnected
              ? buyBalance.value != null
                ? formatTokenAmount(buyBalance.value, buyMeta.token.decimals)
                : '…'
              : null
          }
        />
      </div>

      {rateLabel && visible ? (
        <div className="mt-2 rounded-2xl px-2">
          <div className="flex items-center justify-between gap-3 py-2 text-sm">
            <Freshness updatedAt={quote.dataUpdatedAt} fetching={quote.isFetching} />
            <span className="inline-flex items-center gap-1">
              <button type="button" className="text-right text-ink hover:underline" onClick={() => setInverted((value) => !value)}>
                {rateLabel}
              </button>
              <button
                type="button"
                aria-expanded={detailsOpen}
                aria-label={detailsOpen ? 'Hide trade details' : 'Show trade details'}
                onClick={() => setDetailsOpen((open) => !open)}
                className="grid size-8 place-items-center rounded-full text-muted hover:bg-white/8 hover:text-ink"
              >
                <IconChevron className={cn('size-4 transition-transform duration-200', detailsOpen && 'rotate-180')} />
              </button>
            </span>
          </div>
          {detailsOpen ? (
            <dl className="space-y-2 border-t border-white/8 py-3 text-sm">
              <Detail
                label="Price impact"
                value={impact == null ? '—' : `${impact.toFixed(2)}%`}
                tone={impact ? (impact > 5 ? 'bad' : impact > 2 ? 'warn' : undefined) : undefined}
              />
              <Detail label="Route" value={<RouteSummary quote={visible} sell={sellMeta.token} buy={buyMeta.token} />} />
              <Detail
                label="Minimum output"
                value={
                  amountOutFromQuote
                    ? `${formatUnitsTrim(applySlippage(amountOutFromQuote.toString(), slippage), buyMeta.token.decimals)} ${buyMeta.token.symbol}`
                    : '—'
                }
              />
              <Detail label="Slippage tolerance" value={`${slippage}%`} />
              {partnerFee ? (
                <Detail
                  label="Integrator fee"
                  value={`${partnerFee.fee}%`}
                  tone="warn"
                />
              ) : null}
            </dl>
          ) : null}
        </div>
      ) : null}

      {!sellMeta.ready && sellMeta.error ? (
        <p role="alert" className="mt-2 px-2 text-sm text-bad">
          {sellMeta.error}
        </p>
      ) : null}
      {!buyMeta.ready && buyMeta.error ? (
        <p role="alert" className="mt-2 px-2 text-sm text-bad">
          {buyMeta.error}
        </p>
      ) : null}
      {hardError ? (
        <div role="alert" className="mt-2 rounded-2xl bg-bad/10 px-3 py-3 text-sm text-bad">
          <p>{hardError}</p>
          {multiHopBlocked ? (
            <button
              type="button"
              className="mt-2 font-medium text-ink underline decoration-white/30 underline-offset-2"
              onClick={() => onChange({ sell, buy: NATIVE_ETH })}
            >
              Swap {sellMeta.token.symbol} to ETH first
            </button>
          ) : null}
        </div>
      ) : null}
      {refreshWarning ? <p className="mt-2 px-2 text-sm text-warn">{refreshWarning}</p> : null}
      {isConnected && isNative(sell) && effectiveSellBigInt && sellBalance.value != null && effectiveSellBigInt + GAS_RESERVE > sellBalance.value && effectiveSellBigInt <= sellBalance.value ? (
        <p className="mt-2 px-2 text-sm text-warn">This amount may fail if nothing is left for the network fee.</p>
      ) : null}

      <button
        type="button"
        onClick={onPrimary}
        disabled={intent.disabled || switching}
        aria-busy={pendingQuote || undefined}
        className={cn(
          'mt-2 grid h-14 w-full place-items-center rounded-2xl text-base font-semibold transition-all duration-200',
          intent.disabled
            ? 'bg-white/6 text-muted cursor-not-allowed'
            : 'bg-accent text-accent-ink hover:brightness-105 active:scale-[0.99]',
        )}
      >
        {switching && intent.action === 'switch' ? 'Switching to Base…' : intent.label}
      </button>

      <p className="sr-only" aria-live="polite">
        {synced && amountOutFromQuote
          ? `You receive ${formatUnitsTrim(amountOutFromQuote, buyMeta.token.decimals)} ${buyMeta.token.symbol}`
          : pendingQuote
            ? 'Finding the best price'
            : ''}
      </p>

      {picking ? (
        <TokenDialog
          title={picking === 'sell' ? 'You pay' : 'You receive'}
          tokens={catalog}
          onClose={() => setPicking(null)}
          onSelect={(token) => selectToken(picking, token)}
        />
      ) : null}
      {review && address ? (
        <ReviewDialog
          quote={review.quote}
          quotedAt={review.quotedAt}
          amountIn={review.amountIn}
          sell={sellMeta.token}
          buy={buyMeta.token}
          slippage={slippage}
          account={address}
          onClose={() => setReview(null)}
        />
      ) : null}
    </section>
  )
}

function SwapInputCard({
  id,
  label,
  amount,
  usd,
  token,
  loading,
  faded,
  onAmount,
  onPick,
  balance,
  onMax,
  maxTitle,
}: {
  id: string
  label: string
  amount: string
  usd: number | null
  token: TokenInfo
  loading: boolean
  faded?: boolean
  onAmount: (value: string) => void
  onPick: () => void
  balance: string | null
  onMax?: () => void
  maxTitle?: string
}) {
  const amountSize = amount.length > 14 ? 'text-xl sm:text-2xl' : amount.length > 9 ? 'text-2xl sm:text-3xl' : 'text-[1.85rem] sm:text-[2.5rem]'

  return (
    <div className="min-w-0 rounded-[20px] sm:rounded-[22px] bg-black/25 px-3.5 py-3.5 sm:px-4 sm:py-4 border border-transparent focus-within:border-white/10 transition-colors">
      <div className="flex items-center justify-between text-xs sm:text-sm text-muted">
        <label htmlFor={id}>{label}</label>
        {balance != null ? (
          <span className="inline-flex items-center gap-2">
            <span className="tabular-nums">Balance {balance}</span>
            {onMax ? (
              <button type="button" onClick={onMax} title={maxTitle} className="font-medium text-accent hover:underline">
                Max
              </button>
            ) : null}
          </span>
        ) : (
          <span>Balance —</span>
        )}
      </div>
      <div className="mt-2 flex min-w-0 items-center gap-3">
        <input
          id={id}
          value={amount}
          size={1}
          onChange={(event) => onAmount(event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="0"
          className={cn(
            'w-0 min-w-0 flex-1 bg-transparent font-medium tracking-tight tabular-nums outline-none placeholder:text-white/25 transition-opacity',
            amountSize,
            faded ? 'text-white/35' : 'text-ink',
          )}
        />
        <TokenPill token={token} loading={loading} onClick={onPick} />
      </div>
      <p className="mt-1 h-5 text-sm text-muted tabular-nums">{parsedUsd(amount, usd)}</p>
    </div>
  )
}

function TokenPill({ token, loading, onClick }: { token: TokenInfo; loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={`Choose token, currently ${token.symbol}`}
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-white/8 py-1 pr-3 pl-1.5 hover:bg-white/12 active:scale-95 transition-all"
    >
      <TokenMark address={token.address} symbol={loading ? '?' : token.symbol} size={28} />
      <span className="font-medium">{loading ? '…' : token.symbol}</span>
      <IconChevron className="size-4 text-muted" />
    </button>
  )
}

function Detail({
  label,
  value,
  tone,
}: {
  label: string
  value: string | ReactNode
  tone?: 'good' | 'warn' | 'bad'
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={cn('max-w-[68%] text-right font-medium', tone === 'good' && 'text-good', tone === 'warn' && 'text-warn', tone === 'bad' && 'text-bad')}>
        {value}
      </dd>
    </div>
  )
}

function RouteSummary({ quote, sell, buy }: { quote: QuoteResult; sell: TokenInfo; buy: TokenInfo }) {
  const hops = quote.quote.routePlan
  if (hops.length === 0) return <span>Best available pool</span>
  const symbols = [symbolFor(hops[0]?.tokenA ?? sell.address, sell, buy)]
  for (const hop of hops) symbols.push(symbolFor(hop.tokenB, sell, buy))
  const venues = [...new Set(hops.map((hop) => dexLabel(hop.dexId)))]
  const fees = [...new Set(hops.map((hop) => formatFeeTier(hop.fee)))]
  return (
    <span>
      <span className="block">{symbols.join(' → ')}</span>
      <span className="block text-xs text-muted">
        {venues.join(' · ')} · fee {fees.join(', ')}
      </span>
    </span>
  )
}

function symbolFor(address: string, sell: TokenInfo, buy: TokenInfo): string {
  if (isNative(address)) return 'ETH'
  if (sameToken(address, sell.address)) return sell.symbol
  if (sameToken(address, buy.address)) return buy.symbol
  return findKnown(address)?.symbol ?? shortAddress(address)
}

function Freshness({ updatedAt, fetching }: { updatedAt: number; fetching: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000))
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className={cn('size-1.5 rounded-full transition-colors', fetching ? 'bg-warn animate-pulse' : 'bg-good')} aria-hidden="true" />
      {fetching ? 'Updating price' : seconds < 5 ? 'Updated just now' : `Updated ${seconds}s ago`}
    </span>
  )
}

function parsedUsd(amount: string, usd: number | null): string {
  if (!amount || amount === '.' || amount === '0' || usd == null) return ''
  return formatUsd(usd)
}
