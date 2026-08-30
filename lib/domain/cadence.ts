/**
 * How a planned amount behaves over time.
 *
 * Most lines hold steady or climb with prices. Some are known in advance to
 * change on a date — a lease renewal, a raise already agreed, a subscription
 * ending. All three collapse into the versioned template line the engine
 * already understands, so a cadence is just a nicer way to describe one.
 */

import { addMonths, compareMonth, formatMonthLabel } from './month'
import { formatINR } from './money'
import type { ISOMonth, Paise, TemplateLineVersion } from './types'

export type Cadence =
  | { mode: 'flat' }
  | { mode: 'grows'; ratePct: number }
  | { mode: 'changes'; from: ISOMonth; amount: Paise }
  /** Runs as it is up to and including `after`, then stops entirely. */
  | { mode: 'ends'; after: ISOMonth }

export function cadenceToVersions(
  startMonth: ISOMonth,
  amount: Paise,
  cadence: Cadence,
  name: string,
): TemplateLineVersion[] {
  if (cadence.mode === 'grows') {
    return [{ from: startMonth, amount, growthRatePct: cadence.ratePct }]
  }

  if (cadence.mode === 'ends') {
    return [
      { from: startMonth, amount, growthRatePct: 0 },
      // Zero from the month after the last one it runs.
      {
        from: addMonths(cadence.after, 1),
        amount: 0,
        growthRatePct: 0,
        label: `${name} ends`,
      },
    ]
  }

  if (cadence.mode === 'changes') {
    return [
      { from: startMonth, amount, growthRatePct: 0 },
      {
        from: cadence.from,
        amount: cadence.amount,
        growthRatePct: 0,
        // Surfaces as a pin on the Future timeline.
        label: `${name} changes`,
      },
    ]
  }

  return [{ from: startMonth, amount, growthRatePct: 0 }]
}

/** The one-line summary shown on the chip, in plain language. */
export function describeCadence(cadence: Cadence): string {
  switch (cadence.mode) {
    case 'grows':
      return cadence.ratePct === 0
        ? 'Same every month'
        : `Climbs ${cadence.ratePct}% a year`
    case 'changes':
      return `Becomes ${formatINR(cadence.amount)} in ${formatMonthLabel(cadence.from)}`
    case 'ends':
      return `Stops after ${formatMonthLabel(cadence.after)}`
    default:
      return 'Same every month'
  }
}

/** Reads a cadence back off an existing line, for editing. */
export function cadenceFromVersions(versions: TemplateLineVersion[]): Cadence {
  const sorted = [...versions].sort((a, b) => compareMonth(a.from, b.from))

  if (sorted.length > 1) {
    const later = sorted[sorted.length - 1]
    // A trailing zero is how "it stops" is stored.
    if (later.amount === 0) return { mode: 'ends', after: addMonths(later.from, -1) }
    return { mode: 'changes', from: later.from, amount: later.amount }
  }

  const rate = sorted[0]?.growthRatePct ?? 0
  return rate === 0 ? { mode: 'flat' } : { mode: 'grows', ratePct: rate }
}
