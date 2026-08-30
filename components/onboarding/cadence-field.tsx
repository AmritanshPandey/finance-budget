'use client'

import { CadenceControl } from '@/components/cadence-control'
import { RupeeField } from '@/components/rupee-field'
import type { Cadence } from '@/lib/domain/cadence'
import type { ISOMonth, Paise } from '@/lib/domain/types'

/** An amount plus how it behaves over time. */
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
  return (
    <div>
      <RupeeField label={label} value={value} onChange={onChange} />
      <div className="mt-2">
        <CadenceControl
          cadence={cadence}
          onChange={onCadenceChange}
          currentAmount={value}
          startMonth={startMonth}
          horizonMonths={horizonMonths}
          defaultGrowthPct={defaultGrowthPct}
        />
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
