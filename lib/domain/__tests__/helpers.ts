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

  // Start from a blank slate: zero every seeded amount and every growth rate,
  // so each assertion below is arithmetic anyone can check by hand.
  doc = {
    ...doc,
    templateLines: doc.templateLines.map((line) => ({
      ...line,
      versions: line.versions.map((v) => ({ ...v, amount: 0, growthRatePct: 0 })),
    })),
  }
  doc = setAmountByName(doc, 'Salary', 100_000)
  doc = setAmountByName(doc, 'Rent', 25_000)

  doc = {
    ...doc,
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

/** Turn one of the seeded categories into a monthly investment. */
export function investing(
  doc: BudgetDoc,
  categoryName: string,
  rupees: number,
  locked = false,
): BudgetDoc {
  const next = setAmountByName(doc, categoryName, rupees)
  return {
    ...next,
    categories: next.categories.map((c) =>
      c.name === categoryName ? { ...c, kind: 'investment' as const, locked } : c,
    ),
  }
}
