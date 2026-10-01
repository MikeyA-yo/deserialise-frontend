import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { routeTree } from './routeTree.gen'
import { wagmiConfig } from '@/lib/wagmi'
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
import '@/styles.css'
import { API_BASE } from '@/lib/constants'

// ── Warm-up the backend on page load ─────────────────────────────────────────
// The backend may be sleeping (cold start on free-tier hosts like Railway/Render).
// Fire-and-forget a cheap GET to wake it up before the user tries to get a quote.
// This runs once per page load and silently fails if offline.
;(function warmUpBackend() {
  try {
    fetch(API_BASE + '/health', {
      method: 'GET',
      signal: AbortSignal.timeout(30_000),
      mode: 'cors',
    }).catch(() => {
      // Silent — backend may not have a /health route; the TCP connection alone wakes it
      // Try the root path as a fallback
      fetch(API_BASE + '/', { method: 'GET', signal: AbortSignal.timeout(30_000) }).catch(() => {})
    })
  } catch {
    // fetch not available or HTTPS/CORS error — ignore
  }
})()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultPendingComponent: Pending,
  defaultErrorComponent: RouteError,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element missing')

createRoot(root).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig} reconnectOnMount>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)

function Pending() {
  return (
    <div className="grid place-items-center py-24" role="status">
      <span className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-accent" />
      <span className="sr-only">Loading</span>
    </div>
  )
}

function RouteError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Something went wrong loading this page.'
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">This page failed to load</h1>
      <p className="mt-2 text-sm text-muted">{message}</p>
      <button type="button" onClick={() => window.location.reload()} className="mt-6 text-sm text-accent hover:underline">
        Reload
      </button>
    </div>
  )
}

