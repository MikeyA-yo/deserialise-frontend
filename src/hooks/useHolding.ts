import { useBalance, useReadContract } from 'wagmi'
import { base } from 'wagmi/chains'
import { contractAddress, isNative } from '@/lib/tokens'

const balanceOfAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const

export function useHolding(owner: `0x${string}` | undefined, token: string | undefined) {
  const native = !token || isNative(token)
  const contract = token ? contractAddress(token) : null

  const nativeQuery = useBalance({
    address: owner,
    chainId: base.id,
    query: { enabled: Boolean(owner && token && native) },
  })

  const tokenQuery = useReadContract({
    address: contract ?? undefined,
    abi: balanceOfAbi,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    chainId: base.id,
    query: { enabled: Boolean(owner && contract) },
  })

  if (!token) return { value: undefined, isLoading: false, isError: false }

  if (native) {
    return {
      value: nativeQuery.data?.value,
      isLoading: Boolean(owner) && nativeQuery.isLoading && nativeQuery.data == null,
      isError: nativeQuery.isError,
    }
  }

  return {
    value: tokenQuery.data,
    isLoading: Boolean(owner) && tokenQuery.isLoading && tokenQuery.data == null,
    isError: tokenQuery.isError,
  }
}
