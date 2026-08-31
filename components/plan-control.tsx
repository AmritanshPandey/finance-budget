'use client'

import { useState } from 'react'
import { IconChevronDown, IconPlus, IconX } from '@tabler/icons-react'

import { RupeeField } from '@/components/rupee-field'
import {
  describePlan,
  planIsFlat,
  sortSteps,
  type LinePlan,
} from '@/lib/domain/plan'
import { addMonths, formatMonthLabel } from '@/lib/domain/month'
import type { ISOMonth } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

/**
 * The whole life of a line: where it starts, every dated step, whether it
 * climbs, and when it stops. Budgets change more than once, so this takes a
 * list rather than a single change.
 */
export function PlanControl({
  plan,
  onChange,
  horizonMonths,
  compact,
  hideFirstAmount,
}: {
  plan: LinePlan
  onChange: (next: LinePlan) => void
  horizonMonths: number
  compact?: boolean
  /** The first step's amount is already shown by the field above. */
  hideFirstAmount?: boolean
}) {
  const [open, setOpen] = useState(false)
  const steps = sortSteps(plan.steps)
  const first = steps[0]
  if (!first) return null

  const lastMonth = addMonths(first.from, Math.max(1, horizonMonths - 1))

  function update(next: Partial<LinePlan>) {
    onChange({ ...plan, ...next })
  }

  function setStep(index: number, patch: Partial<{ from: ISOMonth; amount: number }>) {
    update({ steps: steps.map((s, i) => (i === index ? { ...s, ...patch } : s)) })
  }

  function addStep() {
    const last = steps[steps.length - 1]
    update({
      steps: [...steps, { from: addMonths(last.from, 3), amount: last.amount }],
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
          compact ? 'px-2.5 py-1 text-[0.6875rem]' : 'px-3 py-2 text-xs',
          planIsFlat(plan)
            ? 'border-border text-muted-foreground hover:bg-accent'
            : 'border-primary/40 bg-primary/10 text-primary',
        )}
      >
        {describePlan(plan)}
        <IconChevronDown
          size={compact ? 11 : 13}
          className={cn('transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="mt-2.5 space-y-4 rounded-2xl border bg-background p-3">
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={index} className="rounded-xl bg-muted/50 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="label-xs">{index === 0 ? 'Starts' : `Then from`}</span>
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => update({ steps: steps.filter((_, i) => i !== index) })}
                      aria-label={`Remove the change from ${formatMonthLabel(step.from)}`}
                      className="-m-1 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <IconX size={13} stroke={2.2} />
                    </button>
                  )}
                </div>
                <input
                  type="month"
                  value={step.from}
                  max={lastMonth}
                  onChange={(e) => setStep(index, { from: e.target.value as ISOMonth })}
                  className="mt-1 w-full border-b-2 bg-transparent pb-1 num-md outline-none focus:border-primary"
                />
                {!(hideFirstAmount && index === 0) && (
                  <div className="mt-2">
                    <RupeeField
                      label="It is"
                      value={step.amount}
                      onChange={(amount) => setStep(index, { amount })}
                    />
                  </div>
                )}
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={addStep}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <IconPlus size={14} stroke={2.2} />
            Add a change
          </button>

          <label className="block border-t pt-3">
            <span className="label-xs">Then climbs each year by</span>
            <div className="mt-1 flex items-baseline gap-1 border-b-2 pb-1 focus-within:border-primary">
              <input
                inputMode="decimal"
                value={plan.growthRatePct}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  if (Number.isFinite(next)) update({ growthRatePct: next })
                }}
                className="w-full bg-transparent num-md outline-none"
              />
              <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">% a year</span>
            </div>
            <span className="mt-1.5 block text-xs text-muted-foreground">
              Zero holds it still, which is the default.
            </span>
          </label>

          <div className="border-t pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="label-xs">Stops after</span>
              <button
                type="button"
                onClick={() =>
                  update({
                    endsAfter: plan.endsAfter
                      ? undefined
                      : addMonths(steps[steps.length - 1].from, 11),
                  })
                }
                className={cn(
                  'rounded-full border px-3 py-2 text-xs font-medium transition-colors',
                  plan.endsAfter
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {plan.endsAfter ? 'Has an end date' : 'Runs indefinitely'}
              </button>
            </div>
            {plan.endsAfter && (
              <>
                <input
                  type="month"
                  value={plan.endsAfter}
                  max={lastMonth}
                  onChange={(e) => update({ endsAfter: e.target.value as ISOMonth })}
                  className="mt-2 w-full border-b-2 bg-transparent pb-1 num-md outline-none focus:border-primary"
                />
                <span className="mt-1.5 block text-xs text-muted-foreground">
                  Nothing from {formatMonthLabel(addMonths(plan.endsAfter, 1))} onward.
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
