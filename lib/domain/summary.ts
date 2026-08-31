/**
 * The four questions the numbers should answer: what your investments are
 * actually doing, what your loans really cost, how much you keep, and what
 * each habit costs over the whole plan.
 *
 * All derived from the projection and the plan — nothing stored, nothing that
 * can drift from what the rest of the app shows.
 */

import { loanEMI, loanEndMonth, monthsRemaining, totalInterest } from './loan'
import { addMonths, compareMonth, monthsBetween } from './month'
import { investmentType, returnRateFor } from './rates'
import { resolveMonth } from './resolve-month'
import type { BudgetDoc, ISOMonth, Paise, Projection } from './types'

// ---------------------------------------------------------------------------
// Investments
// ---------------------------------------------------------------------------

export interface InvestmentRow {
  categoryId: string
  name: string
  color?: string
  icon?: string
  typeLabel: string
  ratePct: number
  locked: boolean
  contributed: Paise
  value: Paise
  growth: Paise
}

export interface InvestmentSummary {
  rows: InvestmentRow[]
  contributed: Paise
  value: Paise
  growth: Paise
  available: Paise
  locked: Paise
}

export function investmentSummary(
  doc: BudgetDoc,
  projection: Projection,
  atMonth: ISOMonth,
): InvestmentSummary {
  const month =
    projection.months.find((m) => m.month === atMonth) ??
    projection.months[projection.months.length - 1]

  const rows: InvestmentRow[] = Object.entries(month?.pots ?? {})
    .map(([categoryId, value]) => {
      const category = doc.categories.find((c) => c.id === categoryId)
      const contributed = month?.contributed[categoryId] ?? 0
      const type = investmentType(category?.investmentType)
      return {
        categoryId,
        name: category?.name ?? 'Investment',
        color: category?.color,
        icon: category?.icon,
        typeLabel: type.label,
        ratePct: returnRateFor(category?.investmentType, category?.returnRatePctOverride),
        locked: Boolean(category?.locked),
        contributed,
        value,
        growth: value - contributed,
      }
    })
    .sort((a, b) => b.value - a.value)

  const sum = (pick: (r: InvestmentRow) => Paise) => rows.reduce((a, r) => a + pick(r), 0)

  return {
    rows,
    contributed: sum((r) => r.contributed),
    value: sum((r) => r.value),
    growth: sum((r) => r.growth),
    available: rows.filter((r) => !r.locked).reduce((a, r) => a + r.value, 0),
    locked: rows.filter((r) => r.locked).reduce((a, r) => a + r.value, 0),
  }
}

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

export interface LoanRow {
  id: string
  name: string
  emi: Paise
  endsMonth: ISOMonth
  monthsLeft: number
  remaining: Paise
  /** Only knowable when the loan was given as principal and rate. */
  interest: Paise | null
}

export interface LoanSummary {
  rows: LoanRow[]
  monthlyNow: Paise
  remaining: Paise
  interest: Paise | null
  /** When the last loan clears. */
  freeFrom: ISOMonth | null
  /** What is still being paid in the final month — the amount that comes back. */
  freedAmount: Paise
}

export function loanSummary(doc: BudgetDoc, from: ISOMonth): LoanSummary {
  const rows: LoanRow[] = doc.loans
    .map((loan) => {
      const left = monthsRemaining(loan, from)
      return {
        id: loan.id,
        name: loan.name,
        emi: loanEMI(loan),
        endsMonth: loanEndMonth(loan),
        monthsLeft: left,
        remaining: loanEMI(loan) * left,
        interest: totalInterest(loan),
      }
    })
    .sort((a, b) => compareMonth(a.endsMonth, b.endsMonth))

  const active = rows.filter((r) => r.monthsLeft > 0)
  const last = active[active.length - 1]
  const knownInterest = rows.filter((r) => r.interest !== null)

  return {
    rows,
    monthlyNow: active.reduce((a, r) => a + r.emi, 0),
    remaining: rows.reduce((a, r) => a + r.remaining, 0),
    interest: knownInterest.length > 0 ? knownInterest.reduce((a, r) => a + (r.interest ?? 0), 0) : null,
    freeFrom: active.length > 0 ? addMonths(last?.endsMonth ?? from, 1) : null,
    // Only the loans still running in that final month come back.
    freedAmount: last
      ? active.filter((r) => r.endsMonth === last.endsMonth).reduce((a, r) => a + r.emi, 0)
      : 0,
  }
}

/** Ignoring returns, what a lump sum off the principal would save in payments. */
export function prepaymentSaving(doc: BudgetDoc, from: ISOMonth, lump: Paise): Paise {
  let left = lump
  let saved = 0
  // Clearing the shortest remaining loans first frees the most monthly cash.
  for (const row of loanSummary(doc, from).rows) {
    if (left <= 0 || row.monthsLeft <= 0) continue
    const cleared = Math.min(left, row.remaining)
    saved += cleared
    left -= cleared
  }
  return saved
}

// ---------------------------------------------------------------------------
// Savings rate and runway
// ---------------------------------------------------------------------------

export interface SavingsSummary {
  income: Paise
  outgoings: Paise
  kept: Paise
  /** Share of income not spent, including what goes into investments. */
  ratePct: number
  /** Months your cash would last with no income at all. */
  runwayMonths: number
  netWorth: Paise
}

export function savingsSummary(projection: Projection, atMonth: ISOMonth): SavingsSummary {
  const month =
    projection.months.find((m) => m.month === atMonth) ?? projection.months[0]
  if (!month) {
    return { income: 0, outgoings: 0, kept: 0, ratePct: 0, runwayMonths: 0, netWorth: 0 }
  }

  const spending = month.expenses + month.emis
  const kept = month.income - spending
  const burn = spending || 1

  return {
    income: month.income,
    outgoings: spending,
    kept,
    ratePct: month.income > 0 ? Math.round((kept / month.income) * 100) : 0,
    runwayMonths: Math.max(0, Math.floor((month.closingBalance + month.investedAvailable) / burn)),
    netWorth: month.netWorth,
  }
}

// ---------------------------------------------------------------------------
// What each habit costs across the plan
// ---------------------------------------------------------------------------

export interface CostRow {
  categoryId: string
  name: string
  color?: string
  icon?: string
  monthly: Paise
  total: Paise
  months: number
}

export function costOverHorizon(
  doc: BudgetDoc,
  from: ISOMonth,
  months: number,
): { rows: CostRow[]; total: Paise; months: number } {
  const totals = new Map<string, { total: Paise; months: number; last: Paise; name: string }>()

  for (let i = 0; i < months; i++) {
    for (const line of resolveMonth(doc, addMonths(from, i)).lines) {
      // Investing is money kept, not money spent — it belongs in the other card.
      if (line.kind !== 'expense' || line.amount === 0) continue
      const entry = totals.get(line.categoryId) ?? { total: 0, months: 0, last: 0, name: line.categoryName }
      entry.total += line.amount
      entry.months += 1
      entry.last = line.amount
      totals.set(line.categoryId, entry)
    }
  }

  const rows: CostRow[] = [...totals.entries()]
    .map(([categoryId, entry]) => {
      const category = doc.categories.find((c) => c.id === categoryId)
      return {
        categoryId,
        // A loan line carries its own name; only categories need looking up.
        name: category?.name ?? entry.name,
        color: category?.color,
        icon: category?.icon,
        monthly: entry.last,
        total: entry.total,
        months: entry.months,
      }
    })
    .sort((a, b) => b.total - a.total)

  return {
    rows,
    total: rows.reduce((a, r) => a + r.total, 0),
    months: Math.min(months, monthsBetween(from, addMonths(from, months))),
  }
}
