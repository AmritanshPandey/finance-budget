/**
 * How a planned amount behaves over time.
 *
 * Most lines hold steady or climb with prices. Some are known in advance to
 * change on a date — a lease renewal, a raise already agreed, a subscription
 * ending. All three collapse into the versioned template line the engine
 * already understands, so a cadence is just a nicer way to describe one.
 */

import { formatMonthLabel } from './month'
import { formatINR } from './money'
import type { ISOMonth, Paise, TemplateLineVersion } from './types'

export type Cadence =
  | { mode: 'flat' }
  | { mode: 'grows'; ratePct: number }
  | { mode: 'changes'; from: ISOMonth; amount: Paise }

export function cadenceToVersions(
  startMonth: ISOMonth,
  amount: Paise,
  cadence: Cadence,
  name: string,
): TemplateLineVersion[] {
  if (cadence.mode === 'grows') {
    return [{ from: startMonth, amount, growthRatePct: cadence.ratePct }]
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
    default:
      return 'Same every month'
  }
}

/** Reads a cadence back off an existing line, for editing. */
export function cadenceFromVersions(versions: TemplateLineVersion[]): Cadence {
  if (versions.length > 1) {
    const later = versions[versions.length - 1]
    return { mode: 'changes', from: later.from, amount: later.amount }
  }
  const rate = versions[0]?.growthRatePct ?? 0
  return rate === 0 ? { mode: 'flat' } : { mode: 'grows', ratePct: rate }
}
