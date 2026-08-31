/**
 * Everything already planned to happen, in date order.
 *
 * The timeline draws these as pins; this is the same information as a list you
 * can actually edit. Derived entirely from the document — nothing here is
 * stored separately, so it can never drift from the forecast.
 */

import { planFromVersions } from './plan'
import { loanEMI, loanEndMonth } from './loan'
import { addMonths, compareMonth, formatMonthLabel } from './month'
import { formatINR } from './money'
import type { BudgetDoc, ISOMonth, Paise } from './types'

export type ScheduledKind =
  | 'change'
  | 'ends'
  | 'starts'
  | 'loanStart'
  | 'loanEnd'
  | 'oneOff'
  | 'override'

export interface ScheduledChange {
  id: string
  month: ISOMonth
  kind: ScheduledKind
  /** What it applies to. */
  title: string
  /** What happens, in plain language. */
  detail: string
  amount?: Paise
  categoryId?: string
  lineId?: string
  loanId?: string
  oneOffId?: string
}

/** Everything dated at or after `from`, soonest first. */
export function scheduledChanges(doc: BudgetDoc, from: ISOMonth): ScheduledChange[] {
  const out: ScheduledChange[] = []

  for (const line of doc.templateLines) {
    const category = doc.categories.find((c) => c.id === line.categoryId)
    if (!category || category.archivedAt) continue

    const sorted = [...line.versions].sort((a, b) => compareMonth(a.from, b.from))
    sorted.forEach((version, index) => {
      if (compareMonth(version.from, from) < 0) return

      // The first version is when the line begins, not a change to it.
      if (index === 0) {
        if (compareMonth(version.from, from) > 0) {
          out.push({
            id: `start:${line.id}`,
            month: version.from,
            kind: 'starts',
            title: category.name,
            detail: `starts at ${formatINR(version.amount)}`,
            amount: version.amount,
            categoryId: category.id,
            lineId: line.id,
          })
        }
        return
      }

      if (version.amount === 0) {
        out.push({
          id: `ends:${line.id}:${version.from}`,
          month: addMonths(version.from, -1),
          kind: 'ends',
          title: category.name,
          detail: `stops after ${formatMonthLabel(addMonths(version.from, -1))}`,
          categoryId: category.id,
          lineId: line.id,
        })
        return
      }

      out.push({
        id: `change:${line.id}:${version.from}`,
        month: version.from,
        kind: 'change',
        title: category.name,
        detail: `becomes ${formatINR(version.amount)}`,
        amount: version.amount,
        categoryId: category.id,
        lineId: line.id,
      })
    })
  }

  for (const override of doc.overrides) {
    if (compareMonth(override.month, from) < 0) continue
    const line = doc.templateLines.find((l) => l.id === override.lineId)
    const category = line && doc.categories.find((c) => c.id === line.categoryId)
    out.push({
      id: `override:${override.lineId}:${override.month}`,
      month: override.month,
      kind: 'override',
      title: category?.name ?? 'A line',
      detail: `${formatINR(override.amount)} for this month only`,
      amount: override.amount,
      categoryId: category?.id,
      lineId: override.lineId,
    })
  }

  for (const loan of doc.loans) {
    if (compareMonth(loan.startMonth, from) > 0) {
      out.push({
        id: `loanStart:${loan.id}`,
        month: loan.startMonth,
        kind: 'loanStart',
        title: loan.name,
        detail: `starts at ${formatINR(loanEMI(loan))} a month`,
        amount: loanEMI(loan),
        loanId: loan.id,
      })
    }
    const end = loanEndMonth(loan)
    if (compareMonth(end, from) >= 0) {
      out.push({
        id: `loanEnd:${loan.id}`,
        month: end,
        kind: 'loanEnd',
        title: loan.name,
        detail: `paid off — ${formatINR(loanEMI(loan))} a month comes back`,
        amount: loanEMI(loan),
        loanId: loan.id,
      })
    }
  }

  for (const oneOff of doc.oneOffs) {
    if (compareMonth(oneOff.month, from) < 0) continue
    const into =
      oneOff.investIntoCategoryId &&
      doc.categories.find((c) => c.id === oneOff.investIntoCategoryId)
    out.push({
      id: `oneOff:${oneOff.id}`,
      month: oneOff.month,
      kind: 'oneOff',
      title: oneOff.label,
      detail: into
        ? `${formatINR(oneOff.amount)} into ${into.name}`
        : `${oneOff.direction === 'in' ? '+' : '−'}${formatINR(oneOff.amount)} one-off`,
      amount: oneOff.amount,
      oneOffId: oneOff.id,
    })
  }

  return out.sort((a, b) => compareMonth(a.month, b.month) || a.title.localeCompare(b.title))
}

/** The plan a line is currently following, for the editor. */
export function linePlan(doc: BudgetDoc, lineId: string) {
  const line = doc.templateLines.find((l) => l.id === lineId)
  return line ? planFromVersions(line.versions) : null
}

export function isFuture(month: ISOMonth, now: ISOMonth): boolean {
  return compareMonth(month, now) > 0
}
