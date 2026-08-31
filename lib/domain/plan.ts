/**
 * How a line behaves across the whole horizon.
 *
 * Real budgets do not change once. A loan steps down as each small borrowing
 * clears, rent halves when you move, a subscription runs for a year and stops.
 * A plan is therefore an ordered list of dated steps, optionally climbing at a
 * yearly rate from the last one, optionally ending on a date.
 *
 * This maps straight onto the versioned template line the engine already
 * understands — the engine always supported any number of steps; only the
 * editor ever assumed there was one.
 */

import { addMonths, compareMonth, formatMonthLabel } from './month'
import { formatCompactINR } from './money'
import type { ISOMonth, Paise, TemplateLineVersion } from './types'

export interface PlanStep {
  from: ISOMonth
  amount: Paise
}

export interface LinePlan {
  /** At least one, sorted by month. The first is where the line begins. */
  steps: PlanStep[]
  /** Applied from the last step onward. Zero means it holds still. */
  growthRatePct: number
  /** Last month the line runs at all. */
  endsAfter?: ISOMonth
}

export function sortSteps(steps: PlanStep[]): PlanStep[] {
  return [...steps].sort((a, b) => compareMonth(a.from, b.from))
}

export function flatPlan(from: ISOMonth, amount: Paise): LinePlan {
  return { steps: [{ from, amount }], growthRatePct: 0 }
}

export function planToVersions(plan: LinePlan, name: string): TemplateLineVersion[] {
  const steps = sortSteps(plan.steps)
  const versions: TemplateLineVersion[] = steps.map((step, index) => ({
    from: step.from,
    amount: step.amount,
    // Only the final step carries the rate; earlier ones are superseded anyway.
    growthRatePct: index === steps.length - 1 ? plan.growthRatePct : 0,
    label: index > 0 ? `${name} changes` : undefined,
  }))

  if (plan.endsAfter) {
    versions.push({
      from: addMonths(plan.endsAfter, 1),
      amount: 0,
      growthRatePct: 0,
      label: `${name} ends`,
    })
  }

  return versions
}

export function planFromVersions(versions: TemplateLineVersion[]): LinePlan {
  const sorted = [...versions].sort((a, b) => compareMonth(a.from, b.from))
  if (sorted.length === 0) return { steps: [], growthRatePct: 0 }

  const last = sorted[sorted.length - 1]
  // A trailing zero is how "it stops" is stored.
  const ends = sorted.length > 1 && last.amount === 0
  const steps = ends ? sorted.slice(0, -1) : sorted

  return {
    steps: steps.map((v) => ({ from: v.from, amount: v.amount })),
    growthRatePct: steps[steps.length - 1]?.growthRatePct ?? 0,
    ...(ends ? { endsAfter: addMonths(last.from, -1) } : {}),
  }
}

/** Short enough for a chip, specific enough to be worth reading. */
export function describePlan(plan: LinePlan): string {
  const steps = sortSteps(plan.steps)
  const parts: string[] = []

  if (steps.length > 2) {
    parts.push(`${steps.length - 1} changes ahead`)
  } else if (steps.length === 2) {
    parts.push(
      `${formatCompactINR(steps[1].amount)} from ${formatMonthLabel(steps[1].from)}`,
    )
  } else if (plan.growthRatePct !== 0) {
    parts.push(`Climbs ${plan.growthRatePct}% a year`)
  } else if (!plan.endsAfter) {
    parts.push('Same every month')
  }

  if (steps.length > 1 && plan.growthRatePct !== 0) {
    parts.push(`then climbs ${plan.growthRatePct}%`)
  }
  if (plan.endsAfter) {
    parts.push(`stops after ${formatMonthLabel(plan.endsAfter)}`)
  }

  return parts.join(' · ')
}

/** Whether anything at all is scheduled to move. */
export function planIsFlat(plan: LinePlan): boolean {
  return plan.steps.length <= 1 && plan.growthRatePct === 0 && !plan.endsAfter
}
