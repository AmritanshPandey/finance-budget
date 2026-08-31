import { describe, expect, it } from 'vitest'

import { applyGrid, buildGrid, derivePeriods, rowToPlan } from '../grid'
import { planFromVersions } from '../plan'
import { resolveMonth } from '../resolve-month'
import { toPaise } from '../money'
import { buildRealPlan } from './fixtures/real-plan'

const doc = buildRealPlan()
const FROM = '2026-10'

describe('the columns come from the plan', () => {
  it('finds the months things actually change', () => {
    const periods = derivePeriods(doc, FROM)
    // Exactly the three periods the budget was written in.
    expect(periods.map((p) => p.from)).toEqual(['2026-10', '2026-12', '2027-03'])
  })

  it('labels each stretch by the months it covers', () => {
    const periods = derivePeriods(doc, FROM)
    expect(periods[0].label).toBe('Oct–Nov 2026')
    expect(periods[1].label).toBe('Dec 2026 – Feb 2027')
    expect(periods[2].label).toBe('Mar 2027 on')
  })
})

describe('reading the plan into a table', () => {
  const periods = derivePeriods(doc, FROM)
  const grid = buildGrid(doc, periods)
  const row = (name: string) => grid.rows.find((r) => r.name === name)!

  it('shows what each line is in each stretch', () => {
    expect(row('Rent').amounts).toEqual([toPaise(30_000), toPaise(30_000), toPaise(15_000)])
  })

  it('shows zero before a line starts and after it ends', () => {
    // Travel runs December to February only.
    expect(row('Travel').amounts).toEqual([0, toPaise(25_000), 0])
  })

  it('carries a line that steps twice', () => {
    expect(row('House help').amounts).toEqual([toPaise(8_500), toPaise(7_837), 0])
  })
})

describe('writing a table back', () => {
  const periods = derivePeriods(doc, FROM)

  it('collapses repeats so the timeline is not littered', () => {
    const plan = rowToPlan([toPaise(30_000), toPaise(30_000), toPaise(15_000)], periods)
    expect(plan.steps).toEqual([
      { from: '2026-10', amount: toPaise(30_000) },
      { from: '2027-03', amount: toPaise(15_000) },
    ])
  })

  it('reads a trailing zero as an end date', () => {
    const plan = rowToPlan([toPaise(1_500), 0, 0], periods)
    expect(plan.endsAfter).toBe('2026-11')
    expect(plan.steps).toHaveLength(1)
  })

  it('drops leading zeroes so a line simply starts later', () => {
    const plan = rowToPlan([0, toPaise(25_000), toPaise(25_000)], periods)
    expect(plan.steps).toEqual([{ from: '2026-12', amount: toPaise(25_000) }])
  })

  it('round-trips the whole document unchanged', () => {
    const applied = applyGrid(doc, buildGrid(doc, periods))
    for (const month of ['2026-10', '2026-12', '2027-02', '2027-03', '2028-06']) {
      const before = resolveMonth(doc, month)
      const after = resolveMonth(applied, month)
      expect(after.expenses, month).toBe(before.expenses)
      expect(after.investments, month).toBe(before.investments)
    }
  })

  it('keeps a growth rate the user set by hand', () => {
    const withRate = {
      ...doc,
      templateLines: doc.templateLines.map((l) => ({
        ...l,
        versions: l.versions.map((v) => ({ ...v, growthRatePct: 8 })),
      })),
    }
    const applied = applyGrid(withRate, buildGrid(withRate, periods))
    const rent = applied.templateLines.find(
      (l) => l.categoryId === applied.categories.find((c) => c.name === 'Rent')!.id,
    )!
    expect(planFromVersions(rent.versions).growthRatePct).toBe(8)
  })

  it('applies an edit to every month in the stretch', () => {
    const grid = buildGrid(doc, periods)
    const rent = grid.rows.find((r) => r.name === 'Rent')!
    rent.amounts[2] = toPaise(18_000)
    const applied = applyGrid(doc, grid)

    const at = (m: string) =>
      resolveMonth(applied, m).lines.find((l) => l.categoryName === 'Rent')?.amount
    expect(at('2027-02')).toBe(toPaise(30_000))
    expect(at('2027-03')).toBe(toPaise(18_000))
    expect(at('2027-08')).toBe(toPaise(18_000))
  })
})

describe('loans in the table', () => {
  const periods = derivePeriods(doc, FROM)
  const grid = buildGrid(doc, periods)

  it('shows each loan stepping down, read-only', () => {
    const loans = grid.rows.filter((r) => r.readOnly)
    expect(loans.map((r) => r.name).sort()).toEqual([
      'Loan ending Feb',
      'Loan ending Nov',
      'Main loan',
    ])
    const emis = periods.map((_, i) => loans.reduce((a, r) => a + r.amounts[i], 0))
    expect(emis).toEqual([toPaise(78_000), toPaise(47_663), toPaise(41_063)])
  })

  it('makes the column totals agree with the budget itself', () => {
    const totals = periods.map((_, i) =>
      grid.rows.reduce((a, r) => (r.kind === 'income' ? a : a + r.amounts[i]), 0),
    )
    expect(totals).toEqual([toPaise(177_600), toPaise(177_600), toPaise(190_663)])
  })

  it('never writes a loan row back as a plan', () => {
    const edited = buildGrid(doc, periods)
    const loanRow = edited.rows.find((r) => r.readOnly)!
    loanRow.amounts[0] = toPaise(999)
    const applied = applyGrid(doc, edited)
    expect(resolveMonth(applied, '2026-10').emis).toBe(toPaise(78_000))
  })
})
