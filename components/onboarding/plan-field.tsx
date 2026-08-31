'use client'

import { PlanControl } from '@/components/plan-control'
import { RupeeField } from '@/components/rupee-field'
import { sortSteps, type LinePlan } from '@/lib/domain/plan'
import type { Paise } from '@/lib/domain/types'

/**
 * An amount plus its whole future. The amount field edits the first step, so
 * the two never disagree.
 */
export function PlanField({
  label,
  hint,
  plan,
  onChange,
  horizonMonths,
}: {
  label: string
  hint?: React.ReactNode
  plan: LinePlan
  onChange: (next: LinePlan) => void
  horizonMonths: number
}) {
  const steps = sortSteps(plan.steps)
  const base = steps[0]

  function setBaseAmount(amount: Paise) {
    onChange({ ...plan, steps: steps.map((s, i) => (i === 0 ? { ...s, amount } : s)) })
  }

  return (
    <div>
      <RupeeField label={label} value={base?.amount ?? 0} onChange={setBaseAmount} />
      <div className="mt-2">
        <PlanControl
          plan={plan}
          onChange={onChange}
          horizonMonths={horizonMonths}
        />
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
