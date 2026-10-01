/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGGREGATOR_URL?: string
  readonly VITE_BASE_RPC_URL?: string
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
  readonly VITE_PARTNER_FEE_RECIPIENT?: string
  readonly VITE_PARTNER_FEE_PERCENT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
