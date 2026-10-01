import { useQuery } from '@tanstack/react-query'
import { getQuote, getQuoteForAmountOut, toBigInt } from '@/lib/api'
import { QUOTE_REFRESH_MS } from '@/lib/constants'
import type { QuoteResult } from '@/lib/types'

export type QuoteParams = {
  sell: string
  buy: string
  mode: 'exactIn' | 'exactOut'
  amount: string | null
  decimalsA?: number
  decimalsB?: number
  priceA?: number | null
  priceB?: number | null
  enabled: boolean
}

export function useSwapQuote(params: QuoteParams) {
  const { sell, buy, mode, amount, decimalsA = 18, decimalsB = 18, priceA, priceB, enabled } = params
  const sellKey = sell.toLowerCase()
  const buyKey = buy.toLowerCase()

  return useQuery<QuoteResult>({
    queryKey: ['quote', mode, sellKey, buyKey, amount],
    enabled: enabled && Boolean(amount) && amount !== '0',
    retry: false,
    staleTime: 10_000,
    refetchInterval: QUOTE_REFRESH_MS,
    queryFn: ({ signal }) => {
      if (mode === 'exactOut') {
        const outBi = toBigInt(amount ?? '0')
        return getQuoteForAmountOut({
          tokenA: sell,
          tokenB: buy,
          amountOut: outBi,
          decimalsA,
          decimalsB,
          priceA,
          priceB,
          signal,
        })
      }
      return getQuote({
        tokenA: sell,
        tokenB: buy,
        amountIn: amount ?? '0',
        signal,
      })
    },
    placeholderData: (previous, previousQuery) => {
      const [, prevMode, prevSell, prevBuy] = previousQuery?.queryKey ?? []
      if (prevMode === mode && prevSell === sellKey && prevBuy === buyKey) return previous
      return undefined
    },
  })
}
