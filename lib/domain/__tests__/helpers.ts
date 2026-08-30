import { createEmptyDoc, setAmountByName } from '../factory'
import { toPaise } from '../money'
import { newId } from '../id'
import type { BudgetDoc, Goal, ISOMonth } from '../types'

/**
 * A deliberately boring document: ₹1,00,000 in, ₹25,000 rent out, no inflation,
 * no returns, no floor. Surplus is exactly ₹75,000 every month, so every
 * assertion below is arithmetic anyone can check by hand.
 */
export function plainDoc(startMonth: ISOMonth = '2026-01'): BudgetDoc {
  let doc = createEmptyDoc(startMonth)
  doc = setAmountByName(doc, 'Salary', 100_000)
  doc = setAmountByName(doc, 'Rent', 25_000)

  // Strip the growth rate the seed gives Rent so the numbers stay flat.
  doc = {
    ...doc,
    templateLines: doc.templateLines.map((line) => ({
      ...line,
      versions: line.versions.map((v) => ({ ...v, growthRatePct: 0 })),
    })),
    settings: {
      ...doc.settings,
      startingBalance: 0,
      inflationRatePct: 0,
      expectedAnnualReturnPct: 0,
      safetyFloor: { mode: 'fixed', amount: 0 },
      horizonMonths: 120,
    },
  }
  return doc
}

export function goal(input: {
  name: string
  rupees: number
  targetMonth: ISOMonth
  priority?: number
  id?: string
}): Goal {
  return {
    id: input.id ?? newId('goal'),
    name: input.name,
    targetAmount: toPaise(input.rupees),
    targetMonth: input.targetMonth,
    priority: input.priority ?? 0,
    funding: 'savings',
    status: 'active',
  }
}

export function withGoals(doc: BudgetDoc, goals: Goal[]): BudgetDoc {
  return { ...doc, goals }
}
