export type SwapAction = 'connect' | 'switch' | 'review' | 'none'

export function describeSwap(args: {
  connected: boolean
  wrongChain: boolean
  amount: bigint | null
  sameToken: boolean
  ethWrap?: boolean
  pendingQuote: boolean
  quoteError: string | null
  hasQuote: boolean
  balance: bigint | null | undefined
  balanceLoading: boolean
  symbol: string
}): { label: string; disabled: boolean; action: SwapAction } {
  if (!args.connected) return { label: 'Connect wallet', disabled: false, action: 'connect' }
  if (args.wrongChain) return { label: 'Switch to Base', disabled: false, action: 'switch' }
  if (args.sameToken) return { label: 'Select a different token', disabled: true, action: 'none' }
  if (args.ethWrap) return { label: 'Wrap/unwrap not supported via DEX', disabled: true, action: 'none' }
  if (!args.amount || args.amount === 0n) return { label: 'Enter an amount', disabled: true, action: 'none' }
  if (args.balanceLoading) {
    return { label: 'Checking balance', disabled: true, action: 'none' }
  }
  if (args.balance != null && args.amount > args.balance) {
    return { label: `Insufficient ${args.symbol}`, disabled: true, action: 'none' }
  }
  if (args.pendingQuote || !args.hasQuote) {
    return {
      label: args.quoteError && !args.pendingQuote ? 'Quote unavailable' : 'Finding best price',
      disabled: true,
      action: 'none',
    }
  }
  return { label: 'Review swap', disabled: false, action: 'review' }
}
