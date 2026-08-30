import { describe, expect, it } from 'vitest'
import { isLoanActive, loanEndMonth, monthlyEMI, totalInterest } from '../loan'
import { toPaise } from '../money'
import type { Loan } from '../types'

const tenLakhAt9For10Years: Loan = {
  id: 'l1',
  name: 'Education loan',
  principal: toPaise(1_000_000),
  annualRatePct: 9,
  tenureMonths: 120,
  startMonth: '2026-01',
}

describe('EMI', () => {
  it('matches a known amortisation figure', () => {
    // ₹10,00,000 at 9% over 120 months = ₹12,667.58/month
    const emi = monthlyEMI(toPaise(1_000_000), 9, 120)
    expect(emi).toBeGreaterThan(toPaise(12_667))
    expect(emi).toBeLessThan(toPaise(12_668))
  })

  it('falls back to simple division at zero interest', () => {
    expect(monthlyEMI(toPaise(120_000), 0, 12)).toBe(toPaise(10_000))
  })

  it('reports interest paid over the life of the loan', () => {
    expect(totalInterest(tenLakhAt9For10Years)).toBeGreaterThan(toPaise(500_000))
  })
})

describe('loan lifetime', () => {
  it('stops exactly at term end', () => {
    const loan: Loan = { ...tenLakhAt9For10Years, tenureMonths: 3 }
    expect(isLoanActive(loan, '2025-12')).toBe(false)
    expect(isLoanActive(loan, '2026-01')).toBe(true)
    expect(isLoanActive(loan, '2026-03')).toBe(true)
    expect(isLoanActive(loan, '2026-04')).toBe(false)
    expect(loanEndMonth(loan)).toBe('2026-03')
  })
})
