import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAccount, useBalance, useConnect, useConnectors, useDisconnect, useSwitchChain } from 'wagmi'
import { base } from 'wagmi/chains'
import { IconCopy, IconExternal, IconWallet } from '@/components/icons'
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

function ConnectDialog({ onClose }: { onClose: () => void }) {
  const connectors = useConnectors()
  const { connect, isPending, variables, error, reset } = useConnect()
  const pendingId = variables?.connector && 'uid' in variables.connector ? variables.connector.uid : undefined

  useEffect(() => () => reset(), [reset])

  return (
    <Modal title="Connect a wallet" description="Swap from your own wallet on Base." onClose={onClose}>
      <div className="space-y-2 px-5 pt-2 pb-5">
        {connectors.length === 0 ? (
          <p className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-muted">
            No injected wallet was found in this browser. Install Coinbase Wallet, Rabby, or MetaMask, then reload.
          </p>
        ) : (
          connectors.map((connector) => {
            const pending = isPending && pendingId === connector.uid
            return (
              <button
                key={connector.uid}
                type="button"
                disabled={isPending}
                onClick={() => connect({ connector, chainId: base.id }, { onSuccess: onClose })}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-3 py-3 text-left hover:bg-white/8 disabled:opacity-50"
              >
                {connector.icon ? (
                  <img src={connector.icon} alt="" className="size-8 rounded-lg" />
                ) : (
                  <span className="grid size-8 place-items-center rounded-lg bg-white/8">
                    <IconWallet className="size-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{connector.name}</span>
                  <span className="block text-xs text-muted">{pending ? 'Waiting for approval…' : 'Base'}</span>
                </span>
              </button>
            )
          })
        )}
        {error ? (
          <p role="alert" className="text-sm text-bad">
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
        className="h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink hover:brightness-105"
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
          'flex h-10 items-center gap-2 rounded-full border px-2.5 pr-3 text-sm',
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
