import { describe, expect, it } from 'vitest'
import { project } from '../projection'
import { resolveMonth } from '../resolve-month'
import { toPaise } from '../money'
import { goal, plainDoc, withGoals } from './helpers'
import type { Loan } from '../types'

describe('the plain month', () => {
  it('produces a flat ₹75,000 surplus', () => {
    const p = project(plainDoc())
    expect(p.months[0].month).toBe('2026-01')
    expect(p.months[0].surplus).toBe(toPaise(75_000))
    expect(p.months[0].closingBalance).toBe(toPaise(75_000))
    expect(p.months[11].closingBalance).toBe(toPaise(900_000))
  })
})

describe('nothing grows on its own', () => {
  it('ignores a global rate when the line carries none', () => {
    const base = plainDoc()
    const doc = {
      ...base,
      // Clear the explicit zero the helper writes, as an older document would.
      templateLines: base.templateLines.map((line) =>
        line.categoryId === base.categories.find((c) => c.name === 'Salary')!.id
          ? { ...line, versions: line.versions.map((v) => ({ ...v, growthRatePct: undefined })) }
          : line,
      ),
      // Set as high as it will go; it must still have no effect.
      settings: { ...base.settings, incomeGrowthRatePct: 50, inflationRatePct: 50 },
    }
    const p = project(doc)
    expect(p.months[119].income).toBe(p.months[0].income)
    expect(p.months[119].expenses).toBe(p.months[0].expenses)
  })

  it('grows only when the rate is written on the line itself', () => {
    const base = plainDoc()
    const doc = {
      ...base,
      templateLines: base.templateLines.map((line) =>
        line.categoryId === base.categories.find((c) => c.name === 'Salary')!.id
          ? { ...line, versions: line.versions.map((v) => ({ ...v, growthRatePct: 10 })) }
          : line,
      ),
    }
    // ₹1,00,000 × 1.1 twelve months on.
    expect(project(doc).months[12].income).toBe(toPaise(110_000))
  })
})

describe('goal funding', () => {
  it('funds a goal that fits, on time', () => {
    const doc = withGoals(plainDoc(), [
      goal({ name: 'Travel', rupees: 300_000, targetMonth: '2026-04' }),
    ])
    const [outcome] = project(doc).goalOutcomes
    expect(outcome.fundedMonth).toBe('2026-04')
    expect(outcome.status).toBe('onTime')
    expect(outcome.slipMonths).toBe(0)
  })

  it('defers a goal that does not fit and reports the slip', () => {
    // ₹10,00,000 needs 14 months of ₹75,000 surplus → Feb 2027, 10 months late.
    const doc = withGoals(plainDoc(), [
      goal({ name: "Master's", rupees: 1_000_000, targetMonth: '2026-04' }),
    ])
    const [outcome] = project(doc).goalOutcomes
    expect(outcome.fundedMonth).toBe('2027-02')
    expect(outcome.status).toBe('late')
    expect(outcome.slipMonths).toBe(10)
  })

  it('reports a goal it can never reach rather than dropping it', () => {
    const doc = withGoals(plainDoc(), [
      goal({ name: 'Yacht', rupees: 500_000_000, targetMonth: '2026-04' }),
    ])
    const [outcome] = project(doc).goalOutcomes
    expect(outcome.fundedMonth).toBeNull()
    expect(outcome.status).toBe('unreachable')
  })

  it('never tests a goal before its target month', () => {
    const doc = withGoals(plainDoc(), [
      goal({ name: 'Later', rupees: 75_000, targetMonth: '2027-06' }),
    ])
    const [outcome] = project(doc).goalOutcomes
    expect(outcome.fundedMonth).toBe('2027-06')
  })
})

describe('priority', () => {
  const first = goal({ name: 'A', rupees: 300_000, targetMonth: '2026-04', id: 'a' })
  const second = goal({ name: 'B', rupees: 300_000, targetMonth: '2026-04', id: 'b' })

  it('funds the higher-ranked goal first and pushes the other out', () => {
    const doc = withGoals(plainDoc(), [
      { ...first, priority: 0 },
      { ...second, priority: 1 },
    ])
    const outcomes = project(doc).goalOutcomes
    const a = outcomes.find((o) => o.goalId === 'a')
    const b = outcomes.find((o) => o.goalId === 'b')
    expect(a?.fundedMonth).toBe('2026-04')
    expect(b?.fundedMonth).toBe('2026-08')
  })

  it('swapping the ranking swaps the outcome', () => {
    const doc = withGoals(plainDoc(), [
      { ...first, priority: 1 },
      { ...second, priority: 0 },
    ])
    const outcomes = project(doc).goalOutcomes
    expect(outcomes.find((o) => o.goalId === 'b')?.fundedMonth).toBe('2026-04')
    expect(outcomes.find((o) => o.goalId === 'a')?.fundedMonth).toBe('2026-08')
  })
})

describe('safety floor', () => {
  it('refuses to fund a goal that would cross the floor', () => {
    const base = plainDoc()
    const doc = withGoals(
      { ...base, settings: { ...base.settings, safetyFloor: { mode: 'fixed', amount: toPaise(100_000) } } },
      [goal({ name: 'Car', rupees: 300_000, targetMonth: '2026-01' })],
    )
    const p = project(doc)
    // Needs ₹4,00,000 on hand, not ₹3,00,000 → month 6 rather than month 4.
    expect(p.goalOutcomes[0].fundedMonth).toBe('2026-06')
  })

  it('leaves the balance at or above the floor in every month a goal lands', () => {
    const base = plainDoc()
    const doc = withGoals(
      { ...base, settings: { ...base.settings, safetyFloor: { mode: 'fixed', amount: toPaise(100_000) } } },
      [
        goal({ name: 'A', rupees: 300_000, targetMonth: '2026-01', priority: 0 }),
        goal({ name: 'B', rupees: 500_000, targetMonth: '2026-01', priority: 1 }),
      ],
    )
    for (const month of project(doc).months) {
      if (month.goalsFunded.length > 0) {
        expect(month.closingBalance).toBeGreaterThanOrEqual(month.floor)
      }
    }
  })
})

describe('loans', () => {
  it('adds an EMI line for the life of the loan and no longer', () => {
    const base = plainDoc()
    const loan: Loan = {
      id: 'l1',
      name: 'Car loan',
      spec: { mode: 'principal', principal: toPaise(600_000), annualRatePct: 9 },
      tenureMonths: 36,
      startMonth: '2026-03',
    }
    const doc = { ...base, loans: [loan] }

    expect(resolveMonth(doc, '2026-02').emis).toBe(0)
    expect(resolveMonth(doc, '2026-03').emis).toBeGreaterThan(0)
    expect(resolveMonth(doc, '2029-02').emis).toBeGreaterThan(0)
    expect(resolveMonth(doc, '2029-03').emis).toBe(0)
  })

  it('a loan-funded goal takes only the down payment and starts an EMI stream', () => {
    const base = plainDoc()
    const doc = withGoals(base, [
      {
        ...goal({ name: "Master's", rupees: 2_000_000, targetMonth: '2026-04' }),
        funding: 'loan',
        downPayment: toPaise(200_000),
        loanTerms: { annualRatePct: 9, tenureMonths: 120 },
      },
    ])
    const p = project(doc)
    const outcome = p.goalOutcomes[0]
    // ₹2,00,000 down is affordable by month 3, not month 4 — so it lands on time.
    expect(outcome.status).toBe('onTime')
    expect(outcome.fundedMonth).toBe('2026-04')

    // The EMI begins the month after the purchase and shows up as an expense.
    const may = p.months.find((m) => m.month === '2026-05')
    expect(may?.emis).toBeGreaterThan(0)
    expect(may?.surplus).toBeLessThan(toPaise(75_000))
  })
})

describe('re-baselining', () => {
  it('moves the origin and shifts every subsequent month', () => {
    const base = plainDoc()
    const doc = {
      ...base,
      balanceChecks: [
        { id: 'bc1', date: '2026-03-15', actualBalance: toPaise(500_000), rebaselined: true },
      ],
    }
    const p = project(doc)
    expect(p.originMonth).toBe('2026-03')
    expect(p.months[0].month).toBe('2026-03')
    expect(p.months[0].openingBalance).toBe(toPaise(500_000))
    expect(p.months[0].closingBalance).toBe(toPaise(575_000))
  })

  it('ignores a balance check that was not re-baselined', () => {
    const base = plainDoc()
    const doc = {
      ...base,
      balanceChecks: [
        { id: 'bc1', date: '2026-03-15', actualBalance: toPaise(500_000), rebaselined: false },
      ],
    }
    expect(project(doc).originMonth).toBe('2026-01')
  })
})

describe('one-off income', () => {
  it('lands in the balance and can pull a goal earlier', () => {
    const base = plainDoc()
    const withoutBonus = withGoals(base, [
      goal({ name: 'Car', rupees: 600_000, targetMonth: '2026-01' }),
    ])
    const withBonus = {
      ...withoutBonus,
      oneOffs: [
        { id: 'o1', month: '2026-02', amount: toPaise(300_000), direction: 'in' as const, label: 'Bonus' },
      ],
    }
    const before = project(withoutBonus).goalOutcomes[0].fundedMonth
    const after = project(withBonus).goalOutcomes[0].fundedMonth
    expect(before).toBe('2026-08')
    expect(after).toBe('2026-04')
  })
})
