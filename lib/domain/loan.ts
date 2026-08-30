/**
 * Loan maths. An EMI is a derived monthly expense line that exists for exactly
 * the life of the loan and then disappears.
 */

import { addMonths, compareMonth, monthsBetween } from './month'
import type { ISOMonth, Loan, Paise } from './types'

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

export function loanEMI(loan: Loan): Paise {
  return monthlyEMI(loan.principal, loan.annualRatePct, loan.tenureMonths)
}

/** Last month an EMI is actually paid. */
export function loanEndMonth(loan: Loan): ISOMonth {
  return addMonths(loan.startMonth, Math.max(0, loan.tenureMonths - 1))
}

export function isLoanActive(loan: Loan, month: ISOMonth): boolean {
  if (compareMonth(month, loan.startMonth) < 0) return false
  return monthsBetween(loan.startMonth, month) < loan.tenureMonths
}

/** Total paid across the life of the loan, for "this costs you X in interest". */
export function totalRepayment(loan: Loan): Paise {
  return loanEMI(loan) * loan.tenureMonths
}

export function totalInterest(loan: Loan): Paise {
  return Math.max(0, totalRepayment(loan) - loan.principal)
}
