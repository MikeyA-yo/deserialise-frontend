import { useEffect, useRef, useState } from 'react'
import { IconGear } from '@/components/icons'
import { MAX_SLIPPAGE, MIN_SLIPPAGE } from '@/lib/constants'
import { cn } from '@/lib/cn'
import { sanitizeAmount } from '@/lib/format'

const PRESETS = [0.1, 0.5, 1]

export function SettingsMenu({
  slippage,
  onChange,
}: {
  slippage: number
  onChange: (value: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const custom = Number(draft)
  const customValid = draft !== '' && Number.isFinite(custom) && custom >= MIN_SLIPPAGE && custom <= MAX_SLIPPAGE

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Slippage settings"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid size-10 place-items-center rounded-full text-muted hover:bg-white/8 hover:text-ink"
      >
        <IconGear className="size-5" />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-3xl border border-white/10 bg-raised p-4 shadow-2xl">
          <p className="text-sm font-medium">Slippage tolerance</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            The aggregator builds a minimum received amount from this percentage.
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {PRESETS.map((preset) => {
              const active = draft === '' && slippage === preset
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    onChange(preset)
                    setDraft('')
                  }}
                  className={cn(
                    'h-10 rounded-xl text-sm font-medium',
                    active ? 'bg-accent text-accent-ink' : 'bg-white/6 hover:bg-white/10',
                  )}
                >
                  {preset}%
                </button>
              )
            })}
            <input
              aria-label="Custom slippage percent"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Custom"
              value={draft}
              onChange={(event) => {
                const next = sanitizeAmount(event.target.value, 2)
                setDraft(next)
                const value = Number(next)
                if (Number.isFinite(value) && value >= MIN_SLIPPAGE && value <= MAX_SLIPPAGE) onChange(value)
              }}
              className="h-10 rounded-xl bg-white/6 px-2 text-center text-sm outline-none placeholder:text-muted"
            />
          </div>
          {draft !== '' && !customValid ? (
            <p className="mt-2 text-xs text-warn">Enter a value from 0.1 to 10.</p>
          ) : null}
          {slippage >= 1 ? (
            <p className="mt-2 text-xs text-warn">High slippage can fill at a much worse price.</p>
          ) : null}
          {slippage <= 0.15 ? (
            <p className="mt-2 text-xs text-muted">Tight slippage protects you. The swap can fail if the pool moves.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
