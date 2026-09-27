/**
 * The user's full plan, from both sheets: seven budget periods from Oct 2026 to
 * Feb 2029, then a yearly allocation from 2030 to 2037.
 *
 * Name variants are normalised so a thing is one line for its whole life —
 * "Mom's Pocket Money", "Mom's Money" and "Mum's Money" are one row, as are
 * "Mutual funds"/"Mutual Funds" and "Long term stocks"/"Stocks". That is what
 * makes a colour mean something across eleven years, and what makes a
 * year-on-year comparison possible at all.
 *
 * Where the sheet merges two lines (personal care folding into groceries from
 * Mar 2027) the absorbed line goes to zero rather than disappearing, so the
 * history stays readable.
 */

import type { LineKind } from '../../types'

export type PeriodKey =
  | '2026-10' | '2027-01' | '2027-03' | '2027-08' | '2028-03' | '2028-07'
  | '2030-01' | '2031-01' | '2032-01' | '2033-01' | '2034-01' | '2035-01'
  | '2036-01' | '2037-01'

export const PERIODS: Array<{ from: PeriodKey; label: string; note?: string }> = [
  { from: '2026-10', label: 'Oct – Dec 2026' },
  { from: '2027-01', label: 'Jan – Feb 2027' },
  { from: '2027-03', label: 'Mar – Jul 2027', note: 'Masters begins' },
  { from: '2027-08', label: 'Aug 2027 – Feb 2028' },
  { from: '2028-03', label: 'Mar – Jun 2028' },
  { from: '2028-07', label: 'Jul 2028 – Feb 2029' },
  { from: '2030-01', label: '2030 · age 32' },
  { from: '2031-01', label: '2031 · age 33', note: 'Get married' },
  { from: '2032-01', label: '2032 · age 34', note: 'Promotion or job change' },
  { from: '2033-01', label: '2033 · age 35' },
  { from: '2034-01', label: '2034 · age 36', note: 'Child, change car' },
  { from: '2035-01', label: '2035 · age 37' },
  { from: '2036-01', label: '2036 · age 38' },
  { from: '2037-01', label: '2037 · age 39' },
]

export interface LifeLine {
  name: string
  group: string
  kind?: LineKind
  locked?: boolean
  investmentType?: string
  dueDay?: number
  /** One figure per period, in rupees, same order as PERIODS. */
  by: number[]
}

const _ = 0

export const LIFE_LINES: LifeLine[] = [
  // ——— Income ———————————————————————————————————————————————————————
  { name: 'Salary', group: 'Income', kind: 'income',
    by: [_, _, _, _, _, _, _, _, _, _, _, _, _, _] },

  // ——— Debt —————————————————————————————————————————————————————————
  { name: 'Loans', group: 'Debt',
    by: [85_277, 48_600, 40_270, 34_140, 34_140, 10_500, _, _, _, _, _, _, _, _] },

  // ——— Home —————————————————————————————————————————————————————————
  { name: 'Rent', group: 'Home', dueDay: 5,
    by: [30_000, 30_000, 16_000, 16_000, 18_000, 18_000, 30_000, 30_000, 30_000, 30_000, _, _, _, _] },
  { name: 'Utilities', group: 'Home',
    by: [10_000, 11_500, 10_000, 10_000, 10_000, 10_000, 12_000, 20_000, 25_000, 25_000, 25_000, 25_000, 27_000, 27_000] },
  { name: 'House help', group: 'Home',
    by: [8_500, 7_600, _, _, _, _, _, _, _, _, _, _, _, _] },
  { name: 'Home savings', group: 'Home',
    by: [_, _, _, _, _, _, _, 45_000, 45_000, 60_000, _, _, _, _] },
  { name: 'Home EMI', group: 'Home',
    by: [_, _, _, _, _, _, 75_000, _, _, _, 60_000, 60_000, 60_000, 60_000] },
  { name: 'Future garage', group: 'Home',
    by: [_, _, _, _, _, _, _, _, _, _, _, _, 15_000, 15_000] },

  // ——— Daily ————————————————————————————————————————————————————————
  { name: 'Groceries', group: 'Daily',
    by: [10_000, 10_000, 17_500, 17_500, 17_500, 20_000, 25_000, 30_000, 20_000, 20_000, 30_000, 50_000, 50_000, 50_000] },
  { name: 'Personal care', group: 'Daily',
    by: [6_273, 5_000, _, _, _, _, _, _, _, _, _, _, _, _] },
  { name: 'Commute', group: 'Daily',
    by: [5_000, 25_000, 25_000, 25_000, 25_000, 25_000, 20_000, 40_000, 40_000, 40_000, 40_000, 40_000, 20_000, 20_000] },
  { name: 'Car parking', group: 'Daily',
    by: [1_500, _, _, _, _, _, _, _, _, _, _, _, _, _] },
  { name: 'Fitness', group: 'Daily',
    by: [_, _, _, _, 5_000, 5_000, _, 6_000, 6_000, 6_000, 6_000, 7_000, 7_000, 7_000] },

  // ——— Lifestyle ————————————————————————————————————————————————————
  { name: 'Subscriptions', group: 'Lifestyle',
    by: [7_500, 7_500, 7_500, 7_500, 7_500, 7_500, _, _, _, _, _, _, _, _] },
  { name: 'Going out', group: 'Lifestyle',
    by: [_, _, 5_000, 5_230, 7_500, 8_640, 8_000, 10_000, 10_000, 10_000, 10_000, 15_000, 25_000, 25_000] },
  { name: 'Travel', group: 'Lifestyle',
    by: [_, _, _, 10_000, 5_000, 5_000, _, 10_000, 10_000, 10_000, 10_000, 15_000, 25_000, 25_000] },
  { name: 'Shopping', group: 'Lifestyle',
    by: [_, _, _, _, _, _, _, 5_000, 5_000, 5_000, 5_000, 10_000, 15_000, 15_000] },
  { name: 'Thar', group: 'Lifestyle',
    by: [_, _, _, _, _, _, 75_000, _, _, _, _, _, _, _] },

  // ——— Family ———————————————————————————————————————————————————————
  { name: "Mum's money", group: 'Family',
    by: [2_500, 2_500, 3_000, 3_000, 5_000, 5_000, _, 5_000, 5_000, 5_000, 5_000, 5_000, 10_000, 10_000] },
  { name: 'Dad', group: 'Family',
    by: [_, 10_000, 9_000, 10_000, 10_000, 10_000, _, _, _, _, _, _, _, _] },
  { name: 'Parents', group: 'Family',
    by: [_, _, _, _, _, _, _, 10_000, 15_000, 15_000, 15_000, 15_000, 20_000, 20_000] },
  { name: "Parents' house EMI", group: 'Family',
    by: [_, _, _, _, _, _, _, _, 75_000, 75_000, 75_000, 75_000, 75_000, 75_000] },
  { name: 'Child care', group: 'Family',
    by: [_, _, _, _, _, _, _, 20_000, 20_000, 20_000, 40_000, 40_000, 25_000, 50_000] },

  // ——— Cover ————————————————————————————————————————————————————————
  { name: 'Insurance', group: 'Cover',
    by: [1_100, 1_100, 1_100, 1_100, 1_100, 1_100, 3_000, 3_000, 3_000, 3_000, 6_000, 10_000, 10_000, 10_000] },
  { name: 'Emergency', group: 'Cover',
    by: [_, _, 5_000, _, 7_500, 7_500, _, 15_000, 5_000, 5_000, 35_000, 20_000, 20_000, 20_000] },

  // ——— Investments ——————————————————————————————————————————————————
  { name: 'ELSS', group: 'Investments', kind: 'investment', investmentType: 'elss',
    by: [5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000] },
  { name: 'NPS', group: 'Investments', kind: 'investment', investmentType: 'nps', locked: true,
    by: [5_000, 5_000, 5_200, 5_100, 5_100, 5_100, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000] },
  { name: 'Mutual funds', group: 'Investments', kind: 'investment', investmentType: 'equity-mf',
    by: [_, _, 10_000, 10_000, 10_000, 30_000, _, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000] },
  { name: 'Long-term stocks', group: 'Investments', kind: 'investment', investmentType: 'stocks',
    by: [_, _, 10_000, 10_000, 10_000, 20_000, _, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000] },
  { name: 'RD', group: 'Investments', kind: 'investment', investmentType: 'rd',
    by: [_, _, 10_000, 10_000, 15_000, _, _, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000] },
  { name: 'Day trading', group: 'Investments', kind: 'investment', investmentType: 'stocks',
    by: [_, 8_856, 7_700, 7_700, _, _, _, _, _, _, _, _, _, _] },
  { name: 'Cash', group: 'Investments', kind: 'investment', investmentType: 'savings',
    by: [_, _, _, _, _, 5_000, _, _, _, _, _, _, _, _] },
]

/** What each period is supposed to come to, straight off the sheets. */
export const STATED_TOTALS: number[] = [
  177_650, 177_656, 187_270, 187_270, 198_340, 198_340,
  258_000, 274_000, 339_000, 354_000, 387_000, 412_000, 429_000, 454_000,
]

// ---------------------------------------------------------------------------

import { createEmptyDoc } from '../../factory'
import { newId } from '../../id'
import { inferLook } from '../../look'
import { toPaise } from '../../money'
import { planToVersions, type LinePlan } from '../../plan'
import type { BudgetDoc } from '../../types'

const GROUPS = ['Income', 'Debt', 'Home', 'Daily', 'Lifestyle', 'Family', 'Cover', 'Investments']

/** Figures collapse into steps, so a line only changes when it really changes. */
function planFor(line: LifeLine): LinePlan {
  const steps: LinePlan['steps'] = []
  line.by.forEach((rupees, index) => {
    const amount = toPaise(rupees)
    const previous = steps[steps.length - 1]
    if (previous && previous.amount === amount) return
    steps.push({ from: PERIODS[index].from, amount })
  })

  // Leading zeroes mean the line simply has not started yet.
  while (steps.length > 1 && steps[0].amount === 0) steps.shift()

  if (steps.length > 1 && steps[steps.length - 1].amount === 0) {
    const ending = steps.pop() as { from: string }
    return { steps, growthRatePct: 0, endsAfter: monthBefore(ending.from) }
  }
  return { steps, growthRatePct: 0 }
}

function monthBefore(month: string): string {
  const year = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  return m === 1
    ? `${year - 1}-12`
    : `${year}-${String(m - 1).padStart(2, '0')}`
}

export function buildLifePlan(): BudgetDoc {
  const start = PERIODS[0].from
  const doc = createEmptyDoc(start)

  const groups = GROUPS.map((name, order) => ({ id: newId('grp'), name, order }))
  const byGroup = new Map(groups.map((g) => [g.name, g.id]))

  const categories = LIFE_LINES.map((line, order) => ({
    id: newId('cat'),
    groupId: byGroup.get(line.group) as string,
    name: line.name,
    kind: line.kind ?? ('expense' as const),
    order,
    inflatable: false,
    ...inferLook(line.name),
    ...(line.locked ? { locked: true } : {}),
    ...(line.investmentType ? { investmentType: line.investmentType } : {}),
    ...(line.dueDay ? { dueDay: line.dueDay } : {}),
  }))

  const templateLines = categories.map((category, index) => ({
    id: newId('line'),
    categoryId: category.id,
    versions: planToVersions(planFor(LIFE_LINES[index]), category.name),
  }))

  return {
    ...doc,
    groups,
    categories,
    templateLines,
    settings: {
      ...doc.settings,
      // Oct 2026 through the end of 2037.
      horizonMonths: 135,
      defaultViewMonths: 60,
    },
    onboardedAt: new Date().toISOString().slice(0, 10),
  }
}
