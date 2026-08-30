/**
 * What actually happened, derived from transactions.
 *
 * `resolveMonth` stays the *plan* and is deliberately not muddied with any of
 * this — planned-vs-actual is the difference between the two, and keeping them
 * apart is what makes that comparison possible at all.
 */

import { matchKeyword, relatedIcons } from './look'
import { monthOfDate } from './month'
import type { BudgetDoc, ISOMonth, Paise, Transaction } from './types'

export interface MonthActuals {
  /** Money in. */
  received: Paise
  /** Money out, excluding anything that went into an investment category. */
  spent: Paise
  investedAvailable: Paise
  investedLocked: Paise
  /** Money out per category, for planned-vs-actual and the donut. */
  byCategory: Map<string, Paise>
  count: number
}

export function transactionsIn(doc: BudgetDoc, month: ISOMonth): Transaction[] {
  return doc.transactions.filter((t) => monthOfDate(t.date) === month)
}

export function monthActuals(doc: BudgetDoc, month: ISOMonth): MonthActuals {
  const byCategory = new Map<string, Paise>()
  let received = 0
  let spent = 0
  let investedAvailable = 0
  let investedLocked = 0
  let count = 0

  for (const t of transactionsIn(doc, month)) {
    count += 1
    if (t.direction === 'in') {
      received += t.amount
      continue
    }

    byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount)

    // Money moved into an investment has left the account but is still yours.
    const category = doc.categories.find((c) => c.id === t.categoryId)
    if (category?.kind === 'investment') {
      if (category.locked) investedLocked += t.amount
      else investedAvailable += t.amount
    } else {
      spent += t.amount
    }
  }

  return { received, spent, investedAvailable, investedLocked, byCategory, count }
}

export function hasActuals(doc: BudgetDoc, month: ISOMonth): boolean {
  return doc.transactions.some((t) => monthOfDate(t.date) === month)
}

/** Whether income was logged too — if not, the plan's income still stands. */
export function hasIncomeActuals(doc: BudgetDoc, month: ISOMonth): boolean {
  return doc.transactions.some(
    (t) => monthOfDate(t.date) === month && t.direction === 'in',
  )
}

/** Newest first. */
export function recentTransactions(doc: BudgetDoc, limit = 10): Transaction[] {
  return [...doc.transactions]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, limit)
}

export function normaliseMerchant(merchant: string): string {
  return merchant.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Which category a merchant probably belongs to. Memory of what the user chose
 * last time wins; otherwise the same keyword table that picks icons is asked to
 * find a category wearing the icon this merchant would get.
 */
export function suggestCategory(doc: BudgetDoc, merchant: string): string | null {
  const key = normaliseMerchant(merchant)
  if (!key) return null

  const remembered = doc.merchantMemory[key]
  if (remembered && doc.categories.some((c) => c.id === remembered && !c.archivedAt)) {
    return remembered
  }

  const look = matchKeyword(merchant)
  if (!look) return null

  const spending = doc.categories.filter((c) => !c.archivedAt && c.kind !== 'income')
  const exact = spending.find((c) => c.icon === look.icon)
  if (exact) return exact.id

  // Nothing wears that exact glyph — settle for the same kind of spending,
  // preferring the most general line in the family over a narrow one.
  const family = relatedIcons(look.icon)
  const ranked = spending
    .map((c) => ({ c, rank: c.icon ? family.indexOf(c.icon as never) : -1 }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
  return ranked[0]?.c.id ?? null
}
