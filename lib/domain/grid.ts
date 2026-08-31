/**
 * The budget as a table: rows are lines, columns are stretches of months.
 *
 * This is how the plan is usually written down in the first place — "Oct–Nov,
 * then Dec–Feb, then Mar onwards" — and it is a far faster way to enter a
 * year than opening every line in turn.
 *
 * A column is just a month a step begins. Reading and writing both go through
 * LinePlan, so the table is another view of the same plan rather than a
 * parallel copy of it.
 */

import { LOANS_GROUP_ID } from './constants'
import { isLoanActive, loanEMI } from './loan'
import { loanLineId } from './resolve-month'
import { addMonths, compareMonth, formatMonthLabel, formatMonthShort } from './month'
import { planFromVersions, planToVersions, sortSteps, type LinePlan } from './plan'
import type { BudgetDoc, ISOMonth, LineKind, Paise } from './types'

export interface GridPeriod {
  /** First month of the stretch. */
  from: ISOMonth
  /** Last month before the next stretch begins; undefined for the final one. */
  to?: ISOMonth
  label: string
}

export interface GridRow {
  lineId: string
  /** Loan payments are derived from the loan, so they are shown but not edited. */
  readOnly?: boolean
  categoryId: string
  name: string
  kind: LineKind
  groupId: string
  color?: string
  icon?: string
  /** One amount per period, in the same order. */
  amounts: Paise[]
}

export interface Grid {
  periods: GridPeriod[]
  rows: GridRow[]
}

function labelFor(from: ISOMonth, to?: ISOMonth): string {
  if (!to) return `${formatMonthLabel(from)} on`
  if (from === to) return formatMonthLabel(from)
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  return sameYear
    ? `${formatMonthShort(from)}–${formatMonthLabel(to)}`
    : `${formatMonthLabel(from)} – ${formatMonthLabel(to)}`
}

/**
 * The months your plan already changes on. Those are the natural columns —
 * anything else would be an arbitrary slice.
 */
export function derivePeriods(doc: BudgetDoc, from: ISOMonth): GridPeriod[] {
  const months = new Set<ISOMonth>([from])
  for (const line of doc.templateLines) {
    for (const version of line.versions) {
      if (compareMonth(version.from, from) >= 0) months.add(version.from)
    }
  }

  const sorted = [...months].sort(compareMonth)
  return sorted.map((month, index) => {
    const next = sorted[index + 1]
    const to = next ? addMonths(next, -1) : undefined
    return { from: month, to, label: labelFor(month, to) }
  })
}

/** The amount a plan resolves to at the start of each period. */
function amountsAt(plan: LinePlan, periods: GridPeriod[]): Paise[] {
  const steps = sortSteps(plan.steps)
  return periods.map((period) => {
    if (plan.endsAfter && compareMonth(period.from, plan.endsAfter) > 0) return 0
    let value = 0
    let started = false
    for (const step of steps) {
      if (compareMonth(step.from, period.from) <= 0) {
        value = step.amount
        started = true
      }
    }
    return started ? value : 0
  })
}

export function buildGrid(doc: BudgetDoc, periods: GridPeriod[]): Grid {
  const rows: GridRow[] = doc.templateLines
    .map((line): GridRow | null => {
      const category = doc.categories.find((c) => c.id === line.categoryId)
      if (!category || category.archivedAt) return null
      return {
        lineId: line.id,
        categoryId: category.id,
        name: category.name,
        kind: category.kind,
        groupId: category.groupId,
        color: category.color,
        icon: category.icon,
        amounts: amountsAt(planFromVersions(line.versions), periods),
      }
    })
    .filter((row): row is GridRow => row !== null)

  // Loans are not template lines, but leaving them out would make the column
  // totals disagree with every other screen.
  for (const loan of doc.loans) {
    rows.push({
      lineId: loanLineId(loan.id),
      readOnly: true,
      categoryId: loanLineId(loan.id),
      name: loan.name,
      kind: 'expense',
      groupId: LOANS_GROUP_ID,
      amounts: periods.map((period) => (isLoanActive(loan, period.from) ? loanEMI(loan) : 0)),
    })
  }

  return { periods, rows }
}

/**
 * Write a whole row back as a plan.
 *
 * Consecutive identical amounts collapse into one step, so a table filled in
 * column by column does not litter the timeline with changes that change
 * nothing. A trailing zero becomes an end date rather than a step to zero.
 */
export function rowToPlan(amounts: Paise[], periods: GridPeriod[]): LinePlan {
  const steps: Array<{ from: ISOMonth; amount: Paise }> = []
  amounts.forEach((amount, index) => {
    const previous = steps[steps.length - 1]
    if (previous && previous.amount === amount) return
    steps.push({ from: periods[index].from, amount })
  })

  // Leading zeroes mean the line has not started yet.
  while (steps.length > 1 && steps[0].amount === 0) steps.shift()

  if (steps.length > 1 && steps[steps.length - 1].amount === 0) {
    const ending = steps.pop() as { from: ISOMonth }
    return { steps, growthRatePct: 0, endsAfter: addMonths(ending.from, -1) }
  }

  return { steps: steps.length > 0 ? steps : [{ from: periods[0].from, amount: 0 }], growthRatePct: 0 }
}

export function applyGrid(doc: BudgetDoc, grid: Grid): BudgetDoc {
  const byLine = new Map(grid.rows.map((row) => [row.lineId, row]))
  return {
    ...doc,
    templateLines: doc.templateLines.map((line) => {
      const row = byLine.get(line.id)
      if (!row || row.readOnly) return line
      const existing = planFromVersions(line.versions)
      const plan = rowToPlan(row.amounts, grid.periods)
      // A rate the user set by hand survives a table edit.
      return {
        ...line,
        versions: planToVersions({ ...plan, growthRatePct: existing.growthRatePct }, row.name),
      }
    }),
  }
}
