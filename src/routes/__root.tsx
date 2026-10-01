import { createRootRoute, Link } from '@tanstack/react-router'
import { AppShell } from '@/components/shell'

export const Route = createRootRoute({
  component: AppShell,
  notFoundComponent: NotFound,
})

function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">This page isn’t here</h1>
      <p className="mt-2 text-sm text-muted">The link may be old, or the token address is incomplete.</p>
      <Link to="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink">
        Back to swap
      </Link>
    </div>
  )
}
