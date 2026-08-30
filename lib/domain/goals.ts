/**
 * Turning projection output into the plain sentences the interface shows.
 * Never a percentage, never a signed number — "4 months earlier".
 */

import { formatMonthLabel } from './month'
import type { GoalOutcome, Projection } from './types'

/** "funded Aug 2029 · 4 months late" */
export function describeOutcome(outcome: GoalOutcome): string {
  if (outcome.status === 'unreachable') return 'Not reachable in this plan'
  const when = formatMonthLabel(outcome.fundedMonth as string)
  if (outcome.status === 'onTime') return `On track for ${when}`
  const n = outcome.slipMonths
  return `${when} · ${n} ${n === 1 ? 'month' : 'months'} late`
}

export interface Impact {
  goalId: string
  name: string
  emoji?: string
  /** Negative = earlier, positive = later. */
  deltaMonths: number
  headline: string
}

const UNREACHABLE = 10_000

function positionOf(outcome: GoalOutcome, months: number): number {
  if (!outcome.fundedMonth) return UNREACHABLE
  return months + outcome.slipMonths
}

/**
 * The single biggest consequence of an edit, as one sentence. Returns null when
 * nothing about the future actually changed.
 */
export function describeImpact(
  before: Projection,
  after: Projection,
): Impact | null {
  const previous = new Map(before.goalOutcomes.map((o) => [o.goalId, o]))

  let biggest: Impact | null = null

  for (const now of after.goalOutcomes) {
    const was = previous.get(now.goalId)
    if (!was) continue

    const wasPos = positionOf(was, before.months.length)
    const nowPos = positionOf(now, after.months.length)
    if (wasPos === nowPos) continue

    const label = now.emoji ? `${now.emoji} ${now.name}` : now.name
    let headline: string
    let deltaMonths: number

    if (!was.fundedMonth && now.fundedMonth) {
      deltaMonths = -UNREACHABLE
      headline = `${label} becomes reachable — ${formatMonthLabel(now.fundedMonth)}`
    } else if (was.fundedMonth && !now.fundedMonth) {
      deltaMonths = UNREACHABLE
      headline = `${label} is no longer reachable`
    } else {
      deltaMonths = now.slipMonths - was.slipMonths
      const n = Math.abs(deltaMonths)
      const unit = n === 1 ? 'month' : 'months'
      const direction = deltaMonths < 0 ? 'earlier' : 'later'
      headline = `${label} lands ${formatMonthLabel(
        now.fundedMonth as string,
      )} · ${n} ${unit} ${direction}`
    }

    if (!biggest || Math.abs(deltaMonths) > Math.abs(biggest.deltaMonths)) {
      biggest = { goalId: now.goalId, name: now.name, emoji: now.emoji, deltaMonths, headline }
    }
  }

  return biggest
}

/** "2 on track · 1 late" — the resting state of the impact bar. */
export function summariseOutcomes(outcomes: GoalOutcome[]): string {
  if (outcomes.length === 0) return 'No goals yet'
  const onTime = outcomes.filter((o) => o.status === 'onTime').length
  const late = outcomes.filter((o) => o.status === 'late').length
  const unreachable = outcomes.filter((o) => o.status === 'unreachable').length

  const parts: string[] = []
  if (onTime) parts.push(`${onTime} on track`)
  if (late) parts.push(`${late} late`)
  if (unreachable) parts.push(`${unreachable} out of reach`)
  return parts.join(' · ')
}
