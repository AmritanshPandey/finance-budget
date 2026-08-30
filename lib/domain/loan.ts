/**
 * Loan maths. An EMI is a derived monthly expense line that exists for exactly
 * the life of the loan and then disappears.
 *
 * A loan can be described either by its full terms or — far more usefully — by
 * the two numbers people actually carry in their head: what leaves the account
 * each month, and how many months are left.
 */

import { addMonths, compareMonth, monthsBetween } from './month'
import type { ISOMonth, Loan, LoanSpec, Paise } from './types'

/** EMI = P·r·(1+r)^n / ((1+r)^n − 1), r = annual rate / 12. */
export function monthlyEMI(
  principal: Paise,
  annualRatePct: number,
  tenureMonths: number,
): Paise {
  if (tenureMonths <= 0 || principal <= 0) return 0
  const r = annualRatePct / 12 / 100
  if (r === 0) return Math.round(principal / tenureMonths)
  const growth = Math.pow(1 + r, tenureMonths)
  return Math.round((principal * r * growth) / (growth - 1))
}

export function specEMI(spec: LoanSpec, tenureMonths: number): Paise {
  return spec.mode === 'emi'
    ? spec.emi
    : monthlyEMI(spec.principal, spec.annualRatePct, tenureMonths)
}

export function loanEMI(loan: Loan): Paise {
  return specEMI(loan.spec, loan.tenureMonths)
}

/** Last month an EMI is actually paid. */
export function loanEndMonth(loan: Loan): ISOMonth {
  return addMonths(loan.startMonth, Math.max(0, loan.tenureMonths - 1))
}

export function isLoanActive(loan: Loan, month: ISOMonth): boolean {
  if (compareMonth(month, loan.startMonth) < 0) return false
  return monthsBetween(loan.startMonth, month) < loan.tenureMonths
}

/** Total paid across the life of the loan. */
export function totalRepayment(loan: Loan): Paise {
  return loanEMI(loan) * loan.tenureMonths
}

/**
 * Interest paid over the life of the loan — only knowable when the principal
 * was given. An EMI-and-months-left loan returns null rather than a guess.
 */
export function totalInterest(loan: Loan): Paise | null {
  if (loan.spec.mode !== 'principal') return null
  return Math.max(0, totalRepayment(loan) - loan.spec.principal)
}

/** Months of EMI still to pay from `month` onward, inclusive. */
export function monthsRemaining(loan: Loan, month: ISOMonth): number {
  if (compareMonth(month, loan.startMonth) < 0) return loan.tenureMonths
  return Math.max(0, loan.tenureMonths - monthsBetween(loan.startMonth, month))
}
