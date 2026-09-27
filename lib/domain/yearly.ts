/**
 * The plan seen by year rather than by month.
 *
 * A budget is lived monthly but understood annually: what a thing costs over a
 * year, and whether that is more or less than last year. Everything here is
 * derived from the same resolver the rest of the app uses, so a figure can
 * never disagree with the month it came from.
 */

import { addMonths, compareMonth, monthsBetween } from './month'
import { resolveMonth } from './resolve-month'
import type { BudgetDoc, ISOMonth, LineKind, Paise } from './types'

export interface YearRow {
  categoryId: string
  name: string
  group: string
  groupId: string
  kind: LineKind
  color?: string
  icon?: string
  /** Total spent on this line in each year, same order as `years`. */
  byYear: Paise[]
  total: Paise
}

export interface YearlySummary {
  years: number[]
  rows: YearRow[]
  /** Outgoings per year: spending, EMIs and investing together. */
  totals: Paise[]
  /** Per year, grouped: one entry per group in document order. */
  groups: Array<{ id: string; name: string; byYear: Paise[]; total: Paise }>
}

/** Change from one year to the next, as a percentage. Null when there is nothing to compare. */
export function growthPct(previous: Paise, next: Paise): number | null {
  if (previous === 0) return next === 0 ? null : Infinity
  return ((next - previous) / previous) * 100
}

export function yearsIn(doc: BudgetDoc): number[] {
  const start = doc.settings.startMonth
  const end = addMonths(start, Math.max(0, doc.settings.horizonMonths - 1))
  const first = Number(start.slice(0, 4))
  const last = Number(end.slice(0, 4))
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
}

export function yearlySummary(doc: BudgetDoc): YearlySummary {
  const years = yearsIn(doc)
  const start = doc.settings.startMonth
  const end = addMonths(start, Math.max(0, doc.settings.horizonMonths - 1))

  const byCategory = new Map<string, { row: YearRow }>()
  const totals = years.map(() => 0)

  years.forEach((year, index) => {
    for (let m = 1; m <= 12; m++) {
      const month: ISOMonth = `${year}-${String(m).padStart(2, '0')}`
      // Only months the plan actually covers.
      if (compareMonth(month, start) < 0 || compareMonth(month, end) > 0) continue

      for (const line of resolveMonth(doc, month).lines) {
        if (line.kind === 'income' || line.amount === 0) continue
        totals[index] += line.amount

        let entry = byCategory.get(line.categoryId)
        if (!entry) {
          const category = doc.categories.find((c) => c.id === line.categoryId)
          const group = doc.groups.find((g) => g.id === category?.groupId)
          entry = {
            row: {
              categoryId: line.categoryId,
              name: category?.name ?? line.categoryName,
              group: group?.name ?? 'Loans',
              groupId: category?.groupId ?? line.groupId,
              kind: line.kind,
              color: category?.color,
              icon: category?.icon,
              byYear: years.map(() => 0),
              total: 0,
            },
          }
          byCategory.set(line.categoryId, entry)
        }
        entry.row.byYear[index] += line.amount
        entry.row.total += line.amount
      }
    }
  })

  const rows = [...byCategory.values()].map((e) => e.row).sort((a, b) => b.total - a.total)

  const groupOrder = new Map(doc.groups.map((g) => [g.id, g.order]))
  const groups = [...new Map(rows.map((r) => [r.groupId, r])).keys()]
    .map((groupId) => {
      const members = rows.filter((r) => r.groupId === groupId)
      return {
        id: groupId,
        name: members[0].group,
        byYear: years.map((_, i) => members.reduce((a, r) => a + r.byYear[i], 0)),
        total: members.reduce((a, r) => a + r.total, 0),
      }
    })
    .sort((a, b) => (groupOrder.get(a.id) ?? 99) - (groupOrder.get(b.id) ?? 99))

  return { years, rows, totals, groups }
}

/** How many months of the plan fall in a year — the last one is often partial. */
export function monthsCovered(doc: BudgetDoc, year: number): number {
  const start = doc.settings.startMonth
  const end = addMonths(start, Math.max(0, doc.settings.horizonMonths - 1))
  let count = 0
  for (let m = 1; m <= 12; m++) {
    const month: ISOMonth = `${year}-${String(m).padStart(2, '0')}`
    if (compareMonth(month, start) >= 0 && compareMonth(month, end) <= 0) count++
  }
  return count
}

/** Total months the plan spans, for sanity checks. */
export function planLengthMonths(doc: BudgetDoc): number {
  return monthsBetween(doc.settings.startMonth, addMonths(doc.settings.startMonth, doc.settings.horizonMonths - 1)) + 1
}
