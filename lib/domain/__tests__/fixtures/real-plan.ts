/**
 * The user's real budget, as three periods:
 *   Oct–Nov 2026, Dec 2026–Feb 2027, Mar–Aug 2027.
 *
 * Kept as a fixture so the totals can be checked against their own spreadsheet
 * by the same engine that renders the app.
 */

import { createEmptyDoc, setLineVersionsByName } from '../../factory'
import { newId } from '../../id'
import { inferLook } from '../../look'
import { toPaise } from '../../money'
import { planToVersions, type LinePlan } from '../../plan'
import type { BudgetDoc, LineKind, Loan } from '../../types'

export const START = '2026-10'
const P1 = '2026-10'
const P2 = '2026-12'
const P3 = '2027-03'

interface Line {
  name: string
  group: string
  kind?: LineKind
  locked?: boolean
  dueDay?: number
  plan: LinePlan
}

const rupees = (n: number) => toPaise(n)

/** Steps are given in rupees for readability. */
function plan(
  steps: Array<[string, number]>,
  opts: { endsAfter?: string; growthRatePct?: number } = {},
): LinePlan {
  return {
    steps: steps.map(([from, amount]) => ({ from, amount: rupees(amount) })),
    growthRatePct: opts.growthRatePct ?? 0,
    ...(opts.endsAfter ? { endsAfter: opts.endsAfter } : {}),
  }
}

export const LINES: Line[] = [
  { name: 'Salary', group: 'Income', kind: 'income', plan: plan([[P1, 0]]) },

  { name: 'Rent', group: 'Home', dueDay: 5, plan: plan([[P1, 30_000], [P3, 15_000]]) },
  {
    name: 'Maintenance, electricity and gas',
    group: 'Home',
    plan: plan([[P1, 10_000], [P3, 7_500]]),
  },
  {
    name: 'House help',
    group: 'Home',
    plan: plan([[P1, 8_500], [P2, 7_837]], { endsAfter: '2027-02' }),
  },
  { name: 'Shifting', group: 'Home', plan: plan([[P2, 10_000]], { endsAfter: '2027-02' }) },

  // Groceries absorbs personal care from March, which is why it jumps to 22,000.
  { name: 'Groceries', group: 'Daily', plan: plan([[P1, 11_000], [P3, 22_000]]) },
  {
    name: 'Personal care and protein',
    group: 'Daily',
    plan: plan([[P1, 10_000]], { endsAfter: '2027-02' }),
  },
  { name: 'Commute', group: 'Daily', plan: plan([[P1, 5_000], [P3, 10_000]]) },
  { name: 'Car parking', group: 'Daily', plan: plan([[P1, 1_500]], { endsAfter: '2026-11' }) },

  { name: 'Subscriptions', group: 'Lifestyle', plan: plan([[P1, 7_500]]) },
  // Paused through the move, back at a higher figure afterwards.
  { name: 'Going out', group: 'Lifestyle', plan: plan([[P1, 2_500], [P2, 0], [P3, 6_000]]) },
  { name: 'Travel', group: 'Lifestyle', plan: plan([[P2, 25_000]], { endsAfter: '2027-02' }) },

  {
    name: "Mom's pocket money",
    group: 'Family & cover',
    plan: plan([[P1, 2_500], [P3, 5_000]]),
  },
  { name: 'Life insurance', group: 'Family & cover', plan: plan([[P1, 1_100]]) },

  { name: 'ELSS', group: 'Investments', kind: 'investment', plan: plan([[P1, 5_000]]) },
  {
    name: 'NPS',
    group: 'Investments',
    kind: 'investment',
    locked: true,
    plan: plan([[P1, 5_000], [P3, 5_500]]),
  },
  {
    name: 'Emergency fund',
    group: 'Investments',
    kind: 'investment',
    plan: plan([[P3, 50_000]]),
  },
  { name: 'Cash', group: 'Investments', kind: 'investment', plan: plan([[P3, 15_000]]) },
]

/**
 * Three separate borrowings. Together they are ₹78,000 to November, ₹47,663 to
 * February, then ₹41,063 — which is exactly how the spreadsheet steps down.
 */
export const LOANS: Array<Omit<Loan, 'id'> & { note?: string }> = [
  {
    name: 'Loan ending Nov',
    spec: { mode: 'emi', emi: rupees(30_337) },
    tenureMonths: 2,
    startMonth: P1,
  },
  {
    name: 'Loan ending Feb',
    spec: { mode: 'emi', emi: rupees(6_600) },
    tenureMonths: 5,
    startMonth: P1,
  },
  {
    name: 'Main loan',
    spec: { mode: 'emi', emi: rupees(41_063) },
    // PLACEHOLDER — only the user knows when this one clears.
    tenureMonths: 60,
    startMonth: P1,
  },
]

export function buildRealPlan(): BudgetDoc {
  let doc = createEmptyDoc(START)

  // Start from a clean structure rather than the generic seed.
  const groups = ['Income', 'Home', 'Daily', 'Lifestyle', 'Family & cover', 'Investments'].map(
    (name, order) => ({ id: newId('grp'), name, order }),
  )
  const byGroup = new Map(groups.map((g) => [g.name, g.id]))

  const categories = LINES.map((line, order) => ({
    id: newId('cat'),
    groupId: byGroup.get(line.group) as string,
    name: line.name,
    kind: line.kind ?? ('expense' as LineKind),
    order,
    inflatable: false,
    ...inferLook(line.name),
    ...(line.locked ? { locked: true } : {}),
    ...(line.dueDay ? { dueDay: line.dueDay } : {}),
  }))

  const templateLines = categories.map((category, index) => ({
    id: newId('line'),
    categoryId: category.id,
    versions: planToVersions(LINES[index].plan, category.name),
  }))

  doc = {
    ...doc,
    groups,
    categories,
    templateLines,
    loans: LOANS.map((loan) => ({ ...loan, id: newId('loan') })),
    onboardedAt: new Date().toISOString().slice(0, 10),
  }

  return doc
}

export { setLineVersionsByName }
