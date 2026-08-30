import { describe, expect, it } from 'vitest'

import { project } from '../projection'
import { resolveMonth } from '../resolve-month'
import { setLineAmount } from '../mutations'
import { loanLineId } from '../resolve-month'
import { toPaise } from '../money'
import { goal, investing, plainDoc, withGoals } from './helpers'
import type { Loan } from '../types'

describe('investments are not spending', () => {
  it('leaves the monthly account but accumulates as wealth', () => {
    const doc = investing(plainDoc(), 'ELSS', 10_000)
    const p = project(doc)

    // Surplus drops by the contribution...
    expect(p.months[0].investments).toBe(toPaise(10_000))
    expect(p.months[0].surplus).toBe(toPaise(65_000))
    expect(p.months[0].closingBalance).toBe(toPaise(65_000))

    // ...but the money still exists.
    expect(p.months[0].investedAvailable).toBe(toPaise(10_000))
    expect(p.months[0].netWorth).toBe(toPaise(75_000))
  })

  it('would be understated by ₹12L over ten years if treated as an expense', () => {
    const invested = project(investing(plainDoc(), 'ELSS', 10_000))
    const last = invested.months[119]
    // 120 months × ₹10,000 of contributions, all of it still counted.
    expect(last.investedAvailable).toBeGreaterThanOrEqual(toPaise(1_200_000))
    expect(last.netWorth).toBeGreaterThan(last.closingBalance)
  })
})

describe('locked investments', () => {
  it('count as wealth but never fund a goal', () => {
    const doc = withGoals(investing(plainDoc(), 'NPS', 20_000, true), [
      goal({ name: 'Car', rupees: 600_000, targetMonth: '2026-01' }),
    ])
    const p = project(doc)

    // Surplus is ₹55,000 once NPS is taken out, so the car needs 11 months —
    // the ₹20,000/month in NPS is visible but untouchable.
    expect(p.goalOutcomes[0].fundedMonth).toBe('2026-11')
    const funded = p.months.find((m) => m.month === '2026-11')
    expect(funded?.investedLocked).toBeGreaterThan(toPaise(200_000))
  })

  it('an unlocked pot does fund a goal, and sooner', () => {
    const doc = withGoals(investing(plainDoc(), 'ELSS', 20_000, false), [
      goal({ name: 'Car', rupees: 600_000, targetMonth: '2026-01' }),
    ])
    // Same money, now reachable: cash + ELSS together clear ₹6,00,000 by month 8.
    expect(project(doc).goalOutcomes[0].fundedMonth).toBe('2026-08')
  })

  it('draws cash first and only then dips into investments', () => {
    const doc = withGoals(investing(plainDoc(), 'ELSS', 30_000, false), [
      goal({ name: 'Car', rupees: 500_000, targetMonth: '2026-01' }),
    ])
    const p = project(doc)
    const funded = p.months.find((m) => m.goalsFunded.length > 0)
    expect(funded).toBeDefined()
    // Cash is exhausted before a single rupee of ELSS is sold.
    expect(funded?.closingBalance).toBe(0)
    expect(funded?.investedAvailable).toBeGreaterThan(0)
  })
})

describe('a one-month EMI change', () => {
  const loan: Loan = {
    id: 'l1',
    name: 'Loan',
    spec: { mode: 'emi', emi: toPaise(78_000) },
    tenureMonths: 43,
    startMonth: '2026-01',
  }

  it('applies to that month alone', () => {
    const base = { ...plainDoc(), loans: [loan] }
    // A prepayment in March: pay double, that month only.
    const doc = setLineAmount(base, '2026-03', loanLineId('l1'), toPaise(156_000), 'month')

    expect(resolveMonth(doc, '2026-02').emis).toBe(toPaise(78_000))
    expect(resolveMonth(doc, '2026-03').emis).toBe(toPaise(156_000))
    expect(resolveMonth(doc, '2026-04').emis).toBe(toPaise(78_000))
  })

  it('is marked as an override so it can be undone', () => {
    const base = { ...plainDoc(), loans: [loan] }
    const doc = setLineAmount(base, '2026-03', loanLineId('l1'), 0, 'month')
    const line = resolveMonth(doc, '2026-03').lines.find((l) => l.loanId === 'l1')
    expect(line?.amount).toBe(0)
    expect(line?.overridden).toBe(true)
  })
})

describe('loan start labels', () => {
  it('does not repeat the word when the name already says it', async () => {
    const { loanStartLabel } = await import('../resolve-month')
    expect(loanStartLabel('Loan')).toBe('Loan starts')
    expect(loanStartLabel('Home loan')).toBe('Home loan starts')
    expect(loanStartLabel("Master's")).toBe("Master's loan starts")
  })
})
