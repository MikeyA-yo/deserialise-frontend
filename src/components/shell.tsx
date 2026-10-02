import { Link, Outlet } from '@tanstack/react-router'
import { useAccount, useSwitchChain } from 'wagmi'
import { base } from 'wagmi/chains'
import { Mark } from '@/components/icons'
import { WalletButton, WalletProvider } from '@/components/wallet'
import { BASESCAN, SWAP_PROXY } from '@/lib/constants'
import { cn } from '@/lib/cn'
import { shortAddress } from '@/lib/format'

const NAV = [
  { to: '/', label: 'Swap', exact: true },
  { to: '/explore', label: 'Explore', exact: false },
  { to: '/activity', label: 'Activity', exact: false },
] as const

export function AppShell() {
  return (
    <WalletProvider>
      <div className="relative min-h-dvh">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(228,255,87,0.09),transparent_62%)]" />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-ink"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-white/8 bg-canvas/75 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3">
            <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight shrink-0">
              <Mark className="size-7 sm:size-8" />
              <span className="hidden sm:inline">Deserialize</span>
            </Link>
            <nav className="flex items-center gap-0.5 sm:gap-1 rounded-full bg-white/5 p-0.5 sm:p-1" aria-label="Primary">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.exact }}
                  activeProps={{ className: 'rounded-full bg-white/10 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-ink' }}
                  inactiveProps={{ className: 'rounded-full px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-muted hover:text-ink' }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <NetworkPill />
              <WalletButton />
            </div>
          </div>
        </header>
        <main id="main" className="relative mx-auto w-full max-w-6xl px-4 pt-8 pb-6">
          <Outlet />
        </main>
        <footer className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] text-center text-xs text-muted">
          <span>Best price across Uniswap v3, PancakeSwap v3, and Aerodrome Slipstream.</span>
          <a
            className="underline decoration-white/20 underline-offset-2 hover:text-ink"
            href={`${BASESCAN}/address/${SWAP_PROXY}`}
            target="_blank"
            rel="noreferrer"
          >
            Proxy {shortAddress(SWAP_PROXY)}
          </a>
        </footer>
      </div>
    </WalletProvider>
  )
}

function NetworkPill() {
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  const wrong = isConnected && chainId !== base.id

  if (!wrong) {
    return (
      <span className={cn('hidden items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-muted md:inline-flex')}>
        <span className="size-1.5 rounded-full bg-good" aria-hidden="true" />
        Base
      </span>
    )
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => switchChain({ chainId: base.id })}
      className="rounded-full border border-warn/40 bg-warn/10 px-3 py-2 text-xs font-medium text-warn"
    >
      {isPending ? 'Switching…' : 'Switch to Base'}
    </button>
  )
}
