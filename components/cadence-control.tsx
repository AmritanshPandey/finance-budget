'use client'

import { useState } from 'react'
import { IconChevronDown } from '@tabler/icons-react'

import { RupeeField } from '@/components/rupee-field'
import { describeCadence, type Cadence } from '@/lib/domain/cadence'
import { addMonths, formatMonthLabel } from '@/lib/domain/month'
import type { ISOMonth, Paise } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

const MODES = [
  { key: 'flat', label: 'Stays the same' },
  { key: 'grows', label: 'Climbs yearly' },
  { key: 'changes', label: 'Changes later' },
  { key: 'ends', label: 'Stops' },
] as const

/**
 * How an amount behaves over time, behind a chip. Accepting the default costs
 * nothing; changing it costs one tap. Used on every line in the app, not just
 * during onboarding.
 */
export function CadenceControl({
  cadence,
  onChange,
  currentAmount,
  startMonth,
  horizonMonths,
  defaultGrowthPct = 6,
  compact,
}: {
  cadence: Cadence
  onChange: (next: Cadence) => void
  currentAmount: Paise
  startMonth: ISOMonth
  horizonMonths: number
  defaultGrowthPct?: number
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const lastMonth = addMonths(startMonth, Math.max(1, horizonMonths - 1))

  function pick(mode: (typeof MODES)[number]['key']) {
    if (mode === 'flat') onChange({ mode: 'flat' })
    if (mode === 'grows')
      onChange({
        mode: 'grows',
        ratePct: cadence.mode === 'grows' ? cadence.ratePct : defaultGrowthPct || 6,
      })
    if (mode === 'changes')
      onChange({
        mode: 'changes',
        from: cadence.mode === 'changes' ? cadence.from : addMonths(startMonth, 12),
        amount: cadence.mode === 'changes' ? cadence.amount : currentAmount,
      })
    if (mode === 'ends')
      onChange({
        mode: 'ends',
        after: cadence.mode === 'ends' ? cadence.after : addMonths(startMonth, 11),
      })
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex items-center gap-1 rounded-full border transition-colors',
          compact ? 'px-2 py-0.5 text-[0.6875rem]' : 'px-2.5 py-1 text-xs',
          cadence.mode === 'flat'
            ? 'border-border text-muted-foreground hover:bg-accent'
            : 'border-primary/40 bg-primary/10 text-primary',
        )}
      >
        {describeCadence(cadence)}
        <IconChevronDown size={compact ? 11 : 13} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-2.5 space-y-4 rounded-2xl border bg-background p-3">
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => pick(mode.key)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  cadence.mode === mode.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {cadence.mode === 'grows' && (
            <label className="block">
              <span className="label-xs">Goes up each year by</span>
              <div className="mt-1 flex items-baseline gap-1 border-b-2 pb-1 focus-within:border-primary">
                <input
                  inputMode="decimal"
                  value={cadence.ratePct}
                  onChange={(e) => {
                    const next = Number(e.target.value)
                    if (Number.isFinite(next)) onChange({ mode: 'grows', ratePct: next })
                  }}
                  className="w-full bg-transparent num-md outline-none"
                />
                <span className="text-xs text-muted-foreground">% a year</span>
              </div>
            </label>
          )}

          {cadence.mode === 'changes' && (
            <div className="space-y-4">
              <label className="block">
                <span className="label-xs">From</span>
                <input
                  type="month"
                  value={cadence.from}
                  min={startMonth}
                  max={lastMonth}
                  onChange={(e) => onChange({ ...cadence, from: e.target.value as ISOMonth })}
                  className="mt-1 w-full border-b-2 bg-transparent pb-1 num-md outline-none focus:border-primary"
                />
              </label>
              <RupeeField
                label="It becomes"
                value={cadence.amount}
                onChange={(amount) => onChange({ ...cadence, amount })}
              />
              <p className="text-xs text-muted-foreground">
                Steady until {formatMonthLabel(cadence.from)}, then this amount from there on.
              </p>
            </div>
          )}

          {cadence.mode === 'ends' && (
            <label className="block">
              <span className="label-xs">Last month it runs</span>
              <input
                type="month"
                value={cadence.after}
                min={startMonth}
                max={lastMonth}
                onChange={(e) => onChange({ ...cadence, after: e.target.value as ISOMonth })}
                className="mt-1 w-full border-b-2 bg-transparent pb-1 num-md outline-none focus:border-primary"
              />
              <span className="mt-1.5 block text-xs text-muted-foreground">
                Nothing from {formatMonthLabel(addMonths(cadence.after, 1))} onward.
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  )
}
