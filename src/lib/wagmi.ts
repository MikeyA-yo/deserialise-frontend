import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'
import { createConfig, http } from 'wagmi'
import { base } from 'wagmi/chains'
import { fallback } from 'viem'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
const customRpc = import.meta.env.VITE_BASE_RPC_URL
const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://deserialize.xyz'

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: 'Deserialize',
      preference: 'all',
    }),
    ...(projectId
      ? [
          walletConnect({
            projectId,
            showQrModal: true,
            metadata: {
              name: 'Deserialize',
              description: 'Swap on Base at the best routed price.',
              url: appUrl,
              icons: [`${appUrl}/favicon.svg`],
            },
          }),
        ]
      : []),
  ],
  transports: {
    [base.id]: customRpc
      ? http(customRpc)
      : fallback([
          http('https://mainnet.base.org'),
          http('https://base-rpc.publicnode.com'),
          http('https://1rpc.io/base'),
        ]),
  },
  ssr: false,
})
