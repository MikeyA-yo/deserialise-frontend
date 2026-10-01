import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SwapCard } from '@/components/swap/SwapCard'
import { useTitle } from '@/hooks/useTitle'
import { NATIVE_ETH } from '@/lib/constants'
import { findKnown, resolveTokenParam, tokenParam } from '@/lib/tokens'

type SwapSearch = {
  sell?: string
  buy?: string
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): SwapSearch => ({
    ...(typeof search.sell === 'string' ? { sell: search.sell } : {}),
    ...(typeof search.buy === 'string' ? { buy: search.buy } : {}),
  }),
  component: SwapPage,
})

function SwapPage() {
  useTitle('Swap · Deserialize')
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/' })
  const usdc = findKnown('usdc')?.address ?? NATIVE_ETH
  const sell = resolveTokenParam(search.sell, NATIVE_ETH)
  const buy = resolveTokenParam(search.buy, usdc)

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[460px] flex-col gap-4 pb-8">
      <SwapCard
        sell={sell}
        buy={buy}
        onChange={(next) => {
          void navigate({
            search: { sell: tokenParam(next.sell), buy: tokenParam(next.buy) },
            replace: true,
          })
        }}
      />
      <p className="px-2 text-center text-xs leading-5 text-muted">
        Quotes come from the Deserialize aggregator. Your wallet sends the transaction to the Base swap proxy, and the
        output token is delivered straight to you.
      </p>
    </div>
  )
}
