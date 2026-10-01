import { useState, useSyncExternalStore } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useTitle } from '@/hooks/useTitle'
import { BASESCAN } from '@/lib/constants'
import { relativeTime, shortAddress } from '@/lib/format'
import { clearActivity, getActivity, subscribeActivity } from '@/lib/storage'
import { tokenParam } from '@/lib/tokens'

export const Route = createFileRoute('/activity')({
  component: ActivityPage,
})

function ActivityPage() {
  useTitle('Activity · Deserialize')
  const items = useSyncExternalStore(subscribeActivity, getActivity, getActivity)
  const [armed, setArmed] = useState(false)

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>
          <p className="mt-2 text-sm text-muted">Swaps confirmed in this browser. Nothing is stored on a server.</p>
        </div>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              if (!armed) {
                setArmed(true)
                return
              }
              clearActivity()
              setArmed(false)
            }}
            className="text-sm text-muted hover:text-ink"
          >
            {armed ? 'Confirm clear' : 'Clear'}
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-white/15 px-6 py-16 text-center">
          <p className="text-lg font-medium">No swaps yet</p>
          <p className="mt-2 text-sm text-muted">A confirmed swap will show the pair, amounts, and a BaseScan link.</p>
          <Link to="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink">
            Start a swap
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((item) => (
            <li key={item.hash} className="rounded-3xl border border-white/10 bg-surface px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {item.sellSymbol} → {item.buySymbol}
                  </p>
                  <p className="mt-1 text-sm text-muted tabular-nums">
                    {item.amountIn} {item.sellSymbol} for {item.amountOut} {item.buySymbol}
                  </p>
                </div>
                <time dateTime={new Date(item.timestamp).toISOString()} className="text-xs text-muted">
                  {relativeTime(item.timestamp)}
                </time>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <a
                  href={`${BASESCAN}/tx/${item.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted underline decoration-white/20 underline-offset-2 hover:text-ink"
                >
                  {shortAddress(item.hash, 6)}
                </a>
                <Link
                  to="/"
                  search={{ sell: tokenParam(item.sellAddress), buy: tokenParam(item.buyAddress) }}
                  className="text-muted hover:text-ink"
                >
                  Swap again
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
