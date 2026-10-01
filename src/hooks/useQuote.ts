import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
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


/** Returns true while the backend is still waking up from a cold start. */
export function useBackendWarming() {
  const [isWarming, setIsWarming] = useState(false)
  const [warmed, setWarmed] = useState(false)

  useEffect(() => {
    if (warmed) return
    let timer: ReturnType<typeof setTimeout>
    const controller = new AbortController()

    // After 3 seconds without a response, flip the warming flag so the UI can show a message
    timer = setTimeout(() => setIsWarming(true), 3000)

    fetch(`${import.meta.env.VITE_AGGREGATOR_URL ?? 'https://evm-api.deserialize.xyz'}/health`, {
      method: 'GET',
      signal: controller.signal,
    })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timer)
        setIsWarming(false)
        setWarmed(true)
      })

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [warmed])

  return { isWarming, warmed }
}
