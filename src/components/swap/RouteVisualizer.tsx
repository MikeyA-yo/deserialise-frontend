import { useMemo, useState } from 'react'
import {
  IconAerodrome,
  IconChevron,
  IconExternal,
  IconPancakeSwap,
  IconRoute,
  IconUniswap,
} from '@/components/icons'
import { TokenMark } from '@/components/TokenMark'
import { BASESCAN } from '@/lib/constants'
import { dexLabel, findKnown, isNative } from '@/lib/tokens'
import type { NormalizedQuote, QuoteRoute, QuoteRouteHop, QuoteRouteToken, TokenInfo } from '@/lib/types'
import { cn } from '@/lib/cn'
import { shortAddress } from '@/lib/format'

const FEE_PIPS = ['UNISWAP_V3_BASE', 'PANCAKE_V3_BASE', 'UNISWAP_V4_BASE']
const FEE_BPS = ['UNISWAP_V2_BASE', 'PANCAKE_V2_BASE', 'AERODROME_V2_BASE']

export function formatHopFee(hop: QuoteRouteHop): string | null {
  const upper = hop.dexId.toUpperCase()
  if (FEE_PIPS.some((id) => upper.includes(id) || upper === id)) {
    return `${hop.fee / 10_000}%`
  }
  if (FEE_BPS.some((id) => upper.includes(id) || upper === id)) {
    return `${hop.fee / 100}%`
  }
  return null
}

export function getDexVisuals(dexId: string, dexName?: string) {
  const upper = dexId.toUpperCase()
  if (upper.includes('PANCAKE')) {
    return {
      name: dexName || 'PancakeSwap V3',
      color: '#1FC7D4',
      bg: 'bg-[#1FC7D4]/10 border-[#1FC7D4]/30 text-[#1FC7D4]',
      icon: <IconPancakeSwap className="size-5 rounded-md shrink-0" />,
    }
  }
  if (upper.includes('AERODROME')) {
    return {
      name: dexName || 'Aerodrome V3',
      color: '#0052FF',
      bg: 'bg-[#0052FF]/10 border-[#0052FF]/30 text-[#4C82FB]',
      icon: <IconAerodrome className="size-5 rounded-md shrink-0" />,
    }
  }
  if (upper.includes('UNISWAP')) {
    return {
      name: dexName || (upper.includes('V4') ? 'Uniswap V4' : 'Uniswap V3'),
      color: '#FF007A',
      bg: 'bg-[#FF007A]/10 border-[#FF007A]/30 text-[#FF007A]',
      icon: <IconUniswap className="size-5 rounded-md shrink-0" />,
    }
  }
  return {
    name: dexName || dexLabel(dexId),
    color: '#E4FF57',
    bg: 'bg-white/5 border-white/10 text-ink',
    icon: (
      <span className="grid size-5 place-items-center rounded-md bg-white/10 text-muted">
        <IconRoute className="size-3" />
      </span>
    ),
  }
}

export function resolveEffectiveRoute(
  quote: NormalizedQuote,
  sell: TokenInfo,
  buy: TokenInfo,
): QuoteRoute | null {
  if (quote.route && quote.route.hops.length > 0) {
    return quote.route
  }

  // Fallback synthesis from routePlan if backend route object is omitted
  if (!quote.routePlan || quote.routePlan.length === 0) return null

  const hops: QuoteRouteHop[] = []
  const path: QuoteRouteToken[] = []

  const firstHop = quote.routePlan[0]
  if (firstHop) {
    path.push({
      address: isNative(sell.address) ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : sell.address,
      symbol: sell.symbol,
      decimals: sell.decimals,
    })
  }

  for (let i = 0; i < quote.routePlan.length; i++) {
    const plan = quote.routePlan[i]
    if (!plan) continue
    const isLast = i === quote.routePlan.length - 1
    const tokenOutMeta = isLast
      ? buy
      : findKnown(plan.tokenB) ?? { address: plan.tokenB, symbol: shortAddress(plan.tokenB), decimals: 18 }

    const tokenInMeta = i === 0 ? sell : path[i] ?? { address: plan.tokenA, symbol: shortAddress(plan.tokenA), decimals: 18 }

    path.push({
      address: isLast && isNative(buy.address) ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : tokenOutMeta.address,
      symbol: tokenOutMeta.symbol,
      decimals: tokenOutMeta.decimals,
    })

    hops.push({
      hop: i + 1,
      dexId: plan.dexId,
      dexName: dexLabel(plan.dexId),
      poolAddress: plan.poolAddress,
      fee: plan.fee,
      tokenIn: {
        address: tokenInMeta.address,
        symbol: tokenInMeta.symbol ?? shortAddress(tokenInMeta.address),
        decimals: tokenInMeta.decimals ?? 18,
      },
      tokenOut: {
        address: tokenOutMeta.address,
        symbol: tokenOutMeta.symbol ?? shortAddress(tokenOutMeta.address),
        decimals: tokenOutMeta.decimals ?? 18,
      },
      amountIn: i === 0 ? quote.amountIn : '0',
      amountOut: isLast ? quote.amountOut : '0',
      amountInFormatted: null,
      amountOutFormatted: null,
      percent: 100,
    })
  }

  return {
    path,
    hops,
    summary: hops.map((h) => `${h.tokenIn.symbol} → ${h.tokenOut.symbol} (${h.dexName})`).join(' · '),
  }
}

export function RouteVisualizer({
  quote,
  sell,
  buy,
  compact = false,
}: {
  quote: NormalizedQuote
  sell: TokenInfo
  buy: TokenInfo
  compact?: boolean
}) {
  const route = useMemo(() => resolveEffectiveRoute(quote, sell, buy), [quote, sell, buy])
  const [expanded, setExpanded] = useState(false)

  if (!route || route.hops.length === 0) {
    return <span className="text-muted">Best available pool</span>
  }

  const tokenLabel = (t: QuoteRouteToken) => t.symbol ?? shortAddress(t.address, 4)

  if (compact && !expanded) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="group inline-flex items-center gap-1.5 text-right font-medium text-ink hover:text-accent transition-colors"
        >
          <span className="flex items-center gap-1">
            {route.hops.map((hop, idx) => {
              const dex = getDexVisuals(hop.dexId, hop.dexName)
              return (
                <span key={hop.hop} className="inline-flex items-center gap-1">
                  {idx > 0 && <span className="text-white/30 text-xs">→</span>}
                  <span className="inline-flex items-center gap-1 rounded-md bg-white/6 px-1.5 py-0.5 text-xs text-muted group-hover:text-ink">
                    {dex.icon}
                    <span>{dex.name.split(' ')[0]}</span>
                    {formatHopFee(hop) && <span className="text-[10px] text-white/40">{formatHopFee(hop)}</span>}
                  </span>
                </span>
              )
            })}
          </span>
          <IconChevron className="size-3.5 text-muted group-hover:text-ink" />
        </button>
        <span className="text-[11px] text-muted">{route.hops.length === 1 ? 'Direct Pool' : `${route.hops.length} Hops`}</span>
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-black/35 p-3.5">
      {/* KyberSwap Header */}
      <div className="flex items-center justify-between border-b border-white/8 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-good" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Order Routing</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-good/15 px-2 py-0.5 text-[10px] font-medium text-good">
            Best Return
          </span>
          {compact && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-xs text-muted hover:text-ink"
            >
              Collapse
            </button>
          )}
        </div>
      </div>

      {/* KyberSwap Flow Diagram (Horizontal Node Flow) */}
      <div className="relative overflow-x-auto pb-2 pt-1 overscroll-contain">
        <div className="flex items-center min-w-max gap-2 px-1">
          {route.hops.map((hop, index) => {
            const dex = getDexVisuals(hop.dexId, hop.dexName)
            const feeTag = formatHopFee(hop)
            const isFirst = index === 0
            const isLast = index === route.hops.length - 1

            return (
              <div key={hop.hop} className="flex items-center gap-2">
                {/* Input Token Node */}
                {isFirst && (
                  <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/4 px-2.5 py-2">
                    <TokenMark address={hop.tokenIn.address} symbol={tokenLabel(hop.tokenIn)} size={26} />
                    <span className="font-semibold text-xs text-ink">{tokenLabel(hop.tokenIn)}</span>
                    <span className="text-[10px] text-muted tabular-nums">
                      {hop.amountInFormatted ? `${Number(hop.amountInFormatted).toFixed(4)}` : 'Input'}
                    </span>
                  </div>
                )}

                {/* Connecting Line with Share Badge */}
                <div className="flex flex-col items-center gap-0.5 px-1">
                  <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[9px] font-semibold text-muted">
                    {hop.percent}%
                  </span>
                  <div className="h-0.5 w-8 bg-gradient-to-r from-accent/40 via-accent to-accent/40 relative">
                    <div className="absolute -top-1 right-0 size-2 rotate-45 border-t border-r border-accent" />
                  </div>
                </div>

                {/* DEX Hop Card */}
                <div className={cn('flex flex-col items-center gap-1 rounded-xl border px-3 py-2 text-center shadow-lg', dex.bg)}>
                  <div className="flex items-center gap-1.5">
                    {dex.icon}
                    <span className="text-xs font-semibold">{dex.name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    {feeTag && <span className="rounded bg-black/30 px-1 py-0.5 font-medium">{feeTag}</span>}
                    {hop.poolAddress && hop.poolAddress.length === 42 && (
                      <a
                        href={`${BASESCAN}/address/${hop.poolAddress}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-muted hover:text-ink hover:underline"
                        title={`Pool ${hop.poolAddress}`}
                      >
                        <span>Pool</span>
                        <IconExternal className="size-2.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Connecting Line to next token */}
                <div className="flex flex-col items-center gap-0.5 px-1">
                  <div className="h-0.5 w-8 bg-gradient-to-r from-accent/40 via-accent to-accent/40 relative">
                    <div className="absolute -top-1 right-0 size-2 rotate-45 border-t border-r border-accent" />
                  </div>
                  <span className="text-[9px] text-muted tabular-nums">
                    {hop.amountOutFormatted ? `${Number(hop.amountOutFormatted).toFixed(2)}` : ''}
                  </span>
                </div>

                {/* Output Token Node */}
                <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/4 px-2.5 py-2">
                  <TokenMark address={hop.tokenOut.address} symbol={tokenLabel(hop.tokenOut)} size={26} />
                  <span className="font-semibold text-xs text-ink">{tokenLabel(hop.tokenOut)}</span>
                  <span className="text-[10px] text-muted tabular-nums">
                    {isLast ? (hop.amountOutFormatted ? `${Number(hop.amountOutFormatted).toFixed(4)}` : 'Output') : 'Hop'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Hop Summary List */}
      <div className="mt-3 divide-y divide-white/6 border-t border-white/8 pt-2">
        {route.hops.map((hop) => {
          const dex = getDexVisuals(hop.dexId, hop.dexName)
          const fee = formatHopFee(hop)
          return (
            <div key={hop.hop} className="flex items-center justify-between py-1.5 text-xs">
              <span className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-accent" />
                <span className="font-medium text-ink">
                  {tokenLabel(hop.tokenIn)} → {tokenLabel(hop.tokenOut)}
                </span>
                <span className="text-muted">via</span>
                <span className="inline-flex items-center gap-1 text-muted">
                  {dex.icon}
                  <span>{dex.name}</span>
                  {fee && <span className="text-white/40">({fee})</span>}
                </span>
              </span>
              <span className="font-mono text-muted tabular-nums">
                {hop.percent}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
