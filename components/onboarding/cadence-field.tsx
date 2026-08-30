'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { RupeeField } from '@/components/rupee-field'
import { describeCadence, type Cadence } from '@/lib/domain/cadence'
import { addMonths, formatMonthLabel } from '@/lib/domain/month'
import type { ISOMonth, Paise } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

const MODES = [
  { key: 'flat', label: 'Stays the same' },
  { key: 'grows', label: 'Climbs yearly' },
  { key: 'changes', label: 'Changes later' },
] as const

/**
 * An amount plus how it behaves over time. The cadence sits behind a chip so
 * accepting the sensible default costs nothing, and changing it costs one tap.
 */
export function CadenceField({
  label,
  hint,
  value,
  onChange,
  cadence,
  onCadenceChange,
  startMonth,
  horizonMonths,
  defaultGrowthPct,
}: {
  label: string
  hint?: React.ReactNode
  value: Paise
  onChange: (next: Paise) => void
  cadence: Cadence
  onCadenceChange: (next: Cadence) => void
  startMonth: ISOMonth
  horizonMonths: number
  defaultGrowthPct: number
}) {
  const [open, setOpen] = useState(false)
  const lastMonth = addMonths(startMonth, Math.max(1, horizonMonths - 1))

  function pick(mode: (typeof MODES)[number]['key']) {
    if (mode === 'flat') onCadenceChange({ mode: 'flat' })
    if (mode === 'grows')
      onCadenceChange({
        mode: 'grows',
        ratePct: cadence.mode === 'grows' ? cadence.ratePct : defaultGrowthPct || 6,
      })
    if (mode === 'changes')
      onCadenceChange({
        mode: 'changes',
        from: cadence.mode === 'changes' ? cadence.from : addMonths(startMonth, 12),
        amount: cadence.mode === 'changes' ? cadence.amount : value,
      })
  }

  return (
    <div>
      <RupeeField label={label} value={value} onChange={onChange} />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'mt-2 flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
          cadence.mode === 'flat'
            ? 'text-muted-foreground hover:bg-accent'
            : 'border-primary/30 bg-primary/5 text-primary',
        )}
      >
        {describeCadence(cadence)}
        <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
      </button>

      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}

      {open && (
        <div className="mt-3 space-y-4 rounded-xl border bg-background p-3">
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
                    if (Number.isFinite(next)) onCadenceChange({ mode: 'grows', ratePct: next })
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
                  onChange={(e) =>
                    onCadenceChange({ ...cadence, from: e.target.value as ISOMonth })
                  }
                  className="mt-1 w-full border-b-2 bg-transparent pb-1 num-md outline-none focus:border-primary"
                />
              </label>
              <RupeeField
                label="It becomes"
                value={cadence.amount}
                onChange={(amount) => onCadenceChange({ ...cadence, amount })}
              />
              <p className="text-xs text-muted-foreground">
                Steady until {formatMonthLabel(cadence.from)}, then this amount from there on.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
