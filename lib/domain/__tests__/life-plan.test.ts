import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { PERIODS, STATED_TOTALS, buildLifePlan } from './fixtures/life-plan'
import { resolveMonth } from '../resolve-month'
import { toPaise } from '../money'

const doc = buildLifePlan()

const outgoings = (month: string) => {
  const view = resolveMonth(doc, month)
  return view.expenses + view.emis + view.investments
}

describe('the whole plan, against the sheets', () => {
  it('every period comes to what the sheet says', () => {
    PERIODS.forEach((period, index) => {
      expect(outgoings(period.from), period.label).toBe(toPaise(STATED_TOTALS[index]))
    })
  })

  it('holds each figure until the next period begins', () => {
    // Oct–Dec 2026 is one figure for three months.
    expect(outgoings('2026-11')).toBe(toPaise(177_650))
    expect(outgoings('2026-12')).toBe(toPaise(177_650))
    expect(outgoings('2027-01')).toBe(toPaise(177_656))
    // Mar–Jul 2027 likewise.
    expect(outgoings('2027-07')).toBe(toPaise(187_270))
  })

  it('carries the last budgeted figure through the gap year', () => {
    // The sheets stop at Feb 2029 and resume in 2030.
    expect(outgoings('2029-06')).toBe(toPaise(198_340))
    expect(outgoings('2030-01')).toBe(toPaise(258_000))
  })

  it('runs to the end of 2037', () => {
    expect(doc.settings.horizonMonths).toBe(135)
    expect(outgoings('2037-12')).toBe(toPaise(454_000))
  })
})

describe('lines that merge or end', () => {
  const amountIn = (month: string, name: string) =>
    resolveMonth(doc, month).lines.find((l) => l.categoryName === name)?.amount ?? 0

  it('folds personal care into groceries in Mar 2027', () => {
    expect(amountIn('2027-02', 'Personal care')).toBe(toPaise(5_000))
    expect(amountIn('2027-02', 'Groceries')).toBe(toPaise(10_000))
    expect(amountIn('2027-03', 'Personal care')).toBe(0)
    expect(amountIn('2027-03', 'Groceries')).toBe(toPaise(17_500))
  })

  it('clears the loans by 2030', () => {
    expect(amountIn('2028-07', 'Loans')).toBe(toPaise(10_500))
    expect(amountIn('2030-01', 'Loans')).toBe(0)
  })

  it('swaps rent for a home EMI in 2034', () => {
    expect(amountIn('2033-06', 'Rent')).toBe(toPaise(30_000))
    expect(amountIn('2034-01', 'Rent')).toBe(0)
    expect(amountIn('2034-01', 'Home EMI')).toBe(toPaise(60_000))
  })

  it("keeps mum's money one line across all eleven years", () => {
    expect(amountIn('2026-10', "Mum's money")).toBe(toPaise(2_500))
    expect(amountIn('2028-03', "Mum's money")).toBe(toPaise(5_000))
    expect(amountIn('2037-01', "Mum's money")).toBe(toPaise(10_000))
  })
})

describe('exporting it', () => {
  it('writes an importable file once every figure holds', () => {
    writeFileSync('life-plan.json', JSON.stringify(doc, null, 2))
    expect(doc.categories.length).toBeGreaterThan(20)
  })
})
