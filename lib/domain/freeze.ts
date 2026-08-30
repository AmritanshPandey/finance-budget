/**
 * Freezing past months.
 *
 * Once a month is behind us its resolved lines are written down verbatim, so
 * renaming, archiving or re-grouping a category can never rewrite history. The
 * snapshot stores the category name alongside the id for exactly this reason.
 */

import { addMonths, compareMonth, currentMonth } from './month'
import { resolveMonth } from './resolve-month'
import type { BudgetDoc, ISOMonth, MonthSnapshot } from './types'

export function freezeMonth(doc: BudgetDoc, month: ISOMonth, today: string): MonthSnapshot {
  const resolved = resolveMonth(doc, month)
  return {
    month,
    frozenAt: today,
    lines: resolved.lines.map((line) => ({
      categoryId: line.categoryId,
      categoryName: line.categoryName,
      amount: line.amount,
      kind: line.kind,
    })),
  }
}

/** Past months that have no snapshot yet, oldest first. */
export function monthsNeedingFreeze(doc: BudgetDoc, now: ISOMonth = currentMonth()): ISOMonth[] {
  const frozen = new Set(doc.snapshots.map((s) => s.month))
  const out: ISOMonth[] = []

  let month = doc.settings.startMonth
  while (compareMonth(month, now) < 0) {
    if (!frozen.has(month)) out.push(month)
    month = addMonths(month, 1)
  }
  return out
}

/**
 * Freeze every month that has fallen into the past. Returns a new snapshot list;
 * callers merge it into the document.
 */
export function freezePastMonths(
  doc: BudgetDoc,
  now: ISOMonth = currentMonth(),
  today: string = new Date().toISOString().slice(0, 10),
): MonthSnapshot[] {
  const pending = monthsNeedingFreeze(doc, now)
  if (pending.length === 0) return doc.snapshots
  return [...doc.snapshots, ...pending.map((m) => freezeMonth(doc, m, today))]
}
