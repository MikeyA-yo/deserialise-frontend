import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconClose } from '@/components/icons'
import { cn } from '@/lib/cn'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  title,
  description,
  onClose,
  children,
  locked = false,
  wide = false,
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  locked?: boolean
  wide?: boolean
}) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const lockedRef = useRef(locked)
  onCloseRef.current = onClose
  lockedRef.current = locked

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    const preferred = panel?.querySelector<HTMLElement>('[data-initial-focus]')
    if (preferred && !preferred.hasAttribute('disabled')) preferred.focus()
    else panel?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !lockedRef.current) {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const nodes = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (node) => !node.hasAttribute('disabled') && node.tabIndex !== -1,
      )
      if (nodes.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const firstNode = nodes[0]
      const lastNode = nodes[nodes.length - 1]
      if (!firstNode || !lastNode) return
      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault()
        lastNode.focus()
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault()
        firstNode.focus()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      previousFocus.current?.focus()
    }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={() => {
        if (!locked) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        className={cn(
          'max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_30px_80px_rgba(0,0,0,0.45)] outline-none sm:rounded-3xl sm:pb-0',
          wide ? 'sm:max-w-md' : 'sm:max-w-[420px]',
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-2">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            aria-label="Close"
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-white/8 hover:text-ink disabled:opacity-40"
          >
            <IconClose className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
