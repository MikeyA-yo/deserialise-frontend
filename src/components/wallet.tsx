import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAccount, useBalance, useConnect, useConnectors, useDisconnect, useSwitchChain } from 'wagmi'
import { base } from 'wagmi/chains'
import {
  IconCoinbase,
  IconCopy,
  IconExternal,
  IconMetaMask,
  IconRainbow,
  IconWallet,
  IconWalletConnect,
} from '@/components/icons'
import { Modal } from '@/components/Modal'
import { BASESCAN } from '@/lib/constants'
import { friendlyError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatTokenAmount, shortAddress } from '@/lib/format'

const OpenWalletContext = createContext<() => void>(() => {})

export function useOpenWallet() {
  return useContext(OpenWalletContext)
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <OpenWalletContext.Provider value={() => setOpen(true)}>
      {children}
      {open ? <ConnectDialog onClose={() => setOpen(false)} /> : null}
    </OpenWalletContext.Provider>
  )
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
}

function ConnectDialog({ onClose }: { onClose: () => void }) {
  const connectors = useConnectors()
  const { connect, isPending, variables, error, reset } = useConnect()
  const pendingId = variables?.connector && 'uid' in variables.connector ? variables.connector.uid : undefined
  const isMobile = useMemo(() => isMobileDevice(), [])
  const [showDeepLinks, setShowDeepLinks] = useState(isMobile)

  useEffect(() => () => reset(), [reset])

  const appHost = typeof window !== 'undefined' ? window.location.host + window.location.pathname : 'deserialize.xyz'
  const appHref = typeof window !== 'undefined' ? window.location.href : 'https://deserialize.xyz'

  function getConnectorMeta(connector: { id: string; name: string }) {
    const id = connector.id.toLowerCase()
    if (id.includes('coinbase')) {
      return {
        title: 'Coinbase Wallet',
        subtitle: 'Smart Wallet (passkey) or mobile app',
        badge: 'Base',
        icon: <IconCoinbase className="size-9 shrink-0" />,
      }
    }
    if (id.includes('walletconnect')) {
      return {
        title: 'WalletConnect',
        subtitle: 'MetaMask, Rainbow, Trust & 100+ mobile wallets',
        badge: isMobile ? 'Mobile' : 'QR / Mobile',
        icon: <IconWalletConnect className="size-9 shrink-0" />,
      }
    }
    if (id.includes('injected')) {
      return {
        title: connector.name === 'Injected' ? 'Browser Wallet' : connector.name,
        subtitle: 'In-app or browser extension',
        badge: 'Detected',
        icon: (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
            <IconWallet className="size-5" />
          </span>
        ),
      }
    }
    return {
      title: connector.name,
      subtitle: 'Base network',
      badge: null,
      icon: (
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/8 text-muted">
          <IconWallet className="size-5" />
        </span>
      ),
    }
  }

  return (
    <Modal
      title="Connect a wallet"
      description="Connect on mobile or desktop to swap on Base."
      onClose={onClose}
    >
      <div className="space-y-2 px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {connectors.length === 0 ? (
          <p className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-muted">
            No wallet connector available in this browser.
          </p>
        ) : (
          connectors.map((connector) => {
            const pending = isPending && pendingId === connector.uid
            const meta = getConnectorMeta(connector)
            return (
              <button
                key={connector.uid}
                type="button"
                disabled={isPending}
                onClick={() => connect({ connector, chainId: base.id }, { onSuccess: onClose })}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-white/8 bg-white/4 p-3 text-left hover:bg-white/8 active:scale-[0.99] disabled:opacity-50 transition-all"
              >
                {connector.icon ? (
                  <img src={connector.icon} alt="" className="size-9 rounded-xl shrink-0" />
                ) : (
                  meta.icon
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="block font-medium text-ink">{meta.title}</span>
                    {meta.badge ? (
                      <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-medium text-muted">
                        {meta.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-xs text-muted">
                    {pending ? 'Waiting for approval…' : meta.subtitle}
                  </span>
                </span>
              </button>
            )
          })
        )}

        {/* Mobile Quick-Launch Deep Links */}
        <div className="mt-4 pt-3 border-t border-white/8">
          <div className="flex items-center justify-between mb-2 px-0.5">
            <span className="text-xs font-medium text-muted">
              {isMobile ? 'Open directly in mobile app' : 'Mobile wallet deep links'}
            </span>
            {!isMobile ? (
              <button
                type="button"
                onClick={() => setShowDeepLinks((open) => !open)}
                className="text-xs text-accent hover:underline"
              >
                {showDeepLinks ? 'Hide' : 'Show links'}
              </button>
            ) : null}
          </div>

          {showDeepLinks ? (
            <div className="grid grid-cols-3 gap-2">
              <a
                href={`https://metamask.app.link/dapp/${appHost}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-white/4 p-2.5 text-center hover:bg-white/8 active:scale-95 transition-all"
              >
                <IconMetaMask className="size-7 rounded-lg" />
                <span className="text-xs font-medium text-ink">MetaMask</span>
                <span className="text-[10px] text-muted leading-none">In-App</span>
              </a>
              <a
                href={`https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(appHref)}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-white/4 p-2.5 text-center hover:bg-white/8 active:scale-95 transition-all"
              >
                <IconCoinbase className="size-7 rounded-lg" />
                <span className="text-xs font-medium text-ink">Coinbase</span>
                <span className="text-[10px] text-muted leading-none">In-App</span>
              </a>
              <a
                href={`https://rnbwapp.com/dapp?url=${encodeURIComponent(appHref)}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-white/4 p-2.5 text-center hover:bg-white/8 active:scale-95 transition-all"
              >
                <IconRainbow className="size-7 rounded-lg" />
                <span className="text-xs font-medium text-ink">Rainbow</span>
                <span className="text-[10px] text-muted leading-none">In-App</span>
              </a>
            </div>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mt-2 text-sm text-bad">
            {friendlyError(error)}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

export function WalletButton() {
  const openWallet = useOpenWallet()
  const { address, isConnected, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending } = useSwitchChain()
  const balance = useBalance({ address, chainId: base.id, query: { enabled: Boolean(address) } })
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const wrongChain = isConnected && chainId !== base.id

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!isConnected || !address) {
    return (
      <button
        type="button"
        onClick={openWallet}
        className="h-9 sm:h-10 rounded-full bg-accent px-3 sm:px-4 text-xs sm:text-sm font-semibold text-accent-ink hover:brightness-105 active:scale-95 transition-transform"
      >
        Connect
      </button>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex h-9 sm:h-10 items-center gap-1.5 sm:gap-2 rounded-full border px-2 sm:px-2.5 pr-2.5 sm:pr-3 text-xs sm:text-sm',
          wrongChain ? 'border-warn/40 bg-warn/10 text-warn' : 'border-white/10 bg-white/5 hover:bg-white/8',
        )}
      >
        <AddressMark address={address} />
        <span className="font-medium tabular-nums">{wrongChain ? 'Wrong network' : shortAddress(address)}</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-64 rounded-3xl border border-white/10 bg-raised p-3 shadow-2xl"
        >
          <p className="px-2 font-mono text-xs text-muted">{shortAddress(address, 6)}</p>
          <p className="px-2 pt-1 text-lg font-medium tabular-nums">
            {balance.data ? `${formatTokenAmount(balance.data.value, 18)} ETH` : 'Balance loading'}
          </p>
          <div className="mt-3 grid gap-1">
            {wrongChain ? (
              <button
                type="button"
                role="menuitem"
                disabled={isPending}
                onClick={() => switchChain({ chainId: base.id })}
                className="rounded-xl px-2 py-2 text-left text-sm text-warn hover:bg-white/6"
              >
                {isPending ? 'Switching…' : 'Switch to Base'}
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(address)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1200)
                } catch {
                  setCopied(false)
                }
              }}
              className="flex items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-white/6"
            >
              <IconCopy className="size-4" />
              {copied ? 'Copied' : 'Copy address'}
            </button>
            <a
              role="menuitem"
              href={`${BASESCAN}/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-white/6"
            >
              <IconExternal className="size-4" />
              View on BaseScan
            </a>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                disconnect()
                setOpen(false)
              }}
              className="rounded-xl px-2 py-2 text-left text-sm text-bad hover:bg-white/6"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function AddressMark({ address }: { address: string }) {
  const start = address.slice(2, 8)
  const end = address.slice(-6)
  return (
    <span
      aria-hidden="true"
      className="size-6 rounded-full"
      style={{ background: `linear-gradient(135deg, #${start}, #${end})` }}
    />
  )
}
