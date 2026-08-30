/**
 * Building a document. Used by onboarding and by tests — the seeded categories
 * are only a starting point; every one of them is renameable, movable and
 * archivable.
 */

import { newId } from './id'
import { inferLook } from './look'
import { currentMonth } from './month'
import { toPaise } from './money'
import type {
  BudgetDoc,
  Category,
  CategoryGroup,
  ISOMonth,
  LineKind,
  Paise,
  Settings,
  TemplateLine,
} from './types'

export const DEFAULT_SETTINGS: Omit<Settings, 'startMonth'> = {
  startingBalance: 0,
  monthlySavingTarget: 0,
  safetyFloor: { mode: 'monthsOfExpenses', months: 3 },
  inflationRatePct: 6,
  incomeGrowthRatePct: 5,
  expectedAnnualReturnPct: 6,
  horizonMonths: 120,
  defaultViewMonths: 60,
}

/** Which onboarding step a seeded line is asked about. */
export type SeedStep = 'income' | 'home' | 'fixed' | 'living' | 'investments'

export interface SeedCategory {
  name: string
  kind: LineKind
  group: string
  step: SeedStep
  inflatable: boolean
  /** Starting cadence: 0 holds steady, a number climbs that much each year. */
  defaultGrowthPct: number
  /** Rent rises faster than general inflation in most Indian cities. */
  growthRatePct?: number
  /** Investments only: goals may never draw on this. */
  locked?: boolean
  /** Starting amount, in rupees. */
  rupees?: number
}

export const SEED_GROUPS = [
  'Income',
  'Home',
  'Daily',
  'Lifestyle',
  'Family & cover',
  'Investments',
] as const

export const SEED_CATEGORIES: SeedCategory[] = [
  { name: 'Salary', kind: 'income', group: 'Income', step: 'income', inflatable: false, defaultGrowthPct: 5 },

  { name: 'Rent', kind: 'expense', group: 'Home', step: 'home', inflatable: false, growthRatePct: 8, defaultGrowthPct: 8, rupees: 30_000 },
  { name: 'Maintenance, electricity and gas', kind: 'expense', group: 'Home', step: 'home', inflatable: true, defaultGrowthPct: 6, rupees: 10_000 },
  { name: 'House help', kind: 'expense', group: 'Home', step: 'home', inflatable: true, defaultGrowthPct: 6, rupees: 8_500 },

  { name: 'Subscriptions', kind: 'expense', group: 'Lifestyle', step: 'fixed', inflatable: false, defaultGrowthPct: 0, rupees: 7_500 },
  { name: 'Life insurance', kind: 'expense', group: 'Family & cover', step: 'fixed', inflatable: false, defaultGrowthPct: 0, rupees: 1_100 },
  { name: "Mom's pocket money", kind: 'expense', group: 'Family & cover', step: 'fixed', inflatable: false, defaultGrowthPct: 0, rupees: 2_500 },
  { name: 'Car parking', kind: 'expense', group: 'Daily', step: 'fixed', inflatable: false, defaultGrowthPct: 0, rupees: 1_500 },

  { name: 'Groceries', kind: 'expense', group: 'Daily', step: 'living', inflatable: true, defaultGrowthPct: 6, rupees: 11_000 },
  { name: 'Commute', kind: 'expense', group: 'Daily', step: 'living', inflatable: true, defaultGrowthPct: 6, rupees: 5_000 },
  { name: 'Personal care and protein', kind: 'expense', group: 'Daily', step: 'living', inflatable: true, defaultGrowthPct: 6, rupees: 5_000 },
  { name: 'Going out', kind: 'expense', group: 'Lifestyle', step: 'living', inflatable: true, defaultGrowthPct: 6, rupees: 2_500 },
  { name: 'Credit card', kind: 'expense', group: 'Lifestyle', step: 'living', inflatable: true, defaultGrowthPct: 6, rupees: 13_500 },

  // Investing is not spending. These leave the account and accumulate.
  { name: 'ELSS', kind: 'investment', group: 'Investments', step: 'investments', inflatable: false, defaultGrowthPct: 0, rupees: 5_000 },
  { name: 'NPS', kind: 'investment', group: 'Investments', step: 'investments', inflatable: false, locked: true, defaultGrowthPct: 0, rupees: 5_000 },
]

/** The EMI seeded alongside the categories. Months left is asked for, not guessed. */
export const SEED_LOAN = { name: 'Loan', rupees: 78_000, defaultMonthsLeft: 36 }

export function createEmptyDoc(startMonth: ISOMonth = currentMonth()): BudgetDoc {
  const groups: CategoryGroup[] = SEED_GROUPS.map((name, order) => ({
    id: newId('grp'),
    name,
    order,
  }))

  const groupByName = new Map(groups.map((g) => [g.name, g.id]))

  const categories: Category[] = SEED_CATEGORIES.map((seed, order) => ({
    id: newId('cat'),
    groupId: groupByName.get(seed.group) as string,
    name: seed.name,
    kind: seed.kind,
    order,
    inflatable: seed.inflatable,
    ...inferLook(seed.name),
    ...(seed.locked ? { locked: true } : {}),
  }))

  const templateLines: TemplateLine[] = categories.map((category, index) => ({
    id: newId('line'),
    categoryId: category.id,
    versions: [
      {
        from: startMonth,
        amount: toPaise(SEED_CATEGORIES[index].rupees ?? 0),
        growthRatePct: SEED_CATEGORIES[index].growthRatePct,
      },
    ],
  }))

  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS, startMonth },
    groups,
    categories,
    templateLines,
    overrides: [],
    snapshots: [],
    loans: [],
    goals: [],
    oneOffs: [],
    balanceChecks: [],
    transactions: [],
    merchantMemory: {},
  }
}

/** Add a category and its template line in one step. */
export function addCategory(
  doc: BudgetDoc,
  input: {
    name: string
    kind: LineKind
    groupId: string
    amount?: Paise
    inflatable?: boolean
    growthRatePct?: number
    from?: ISOMonth
  },
): BudgetDoc {
  const siblings = doc.categories.filter((c) => c.groupId === input.groupId)
  const category: Category = {
    id: newId('cat'),
    groupId: input.groupId,
    name: input.name,
    kind: input.kind,
    order: siblings.length,
    inflatable: input.inflatable ?? input.kind === 'expense',
    ...inferLook(input.name),
  }
  const line: TemplateLine = {
    id: newId('line'),
    categoryId: category.id,
    versions: [
      {
        from: input.from ?? doc.settings.startMonth,
        amount: input.amount ?? 0,
        growthRatePct: input.growthRatePct,
      },
    ],
  }
  return {
    ...doc,
    categories: [...doc.categories, category],
    templateLines: [...doc.templateLines, line],
  }
}

/**
 * Replace a line's whole version history. This is how onboarding records a
 * cadence: one version for "holds steady" or "climbs each year", two when the
 * amount is known to change on a date.
 */
export function setLineVersionsByName(
  doc: BudgetDoc,
  categoryName: string,
  versions: TemplateLine['versions'],
): BudgetDoc {
  const category = doc.categories.find((c) => c.name === categoryName)
  if (!category) return doc
  return {
    ...doc,
    templateLines: doc.templateLines.map((line) =>
      line.categoryId === category.id ? { ...line, versions } : line,
    ),
  }
}

/** Convenience for tests and onboarding: set a category's amount by name. */
export function setAmountByName(
  doc: BudgetDoc,
  categoryName: string,
  rupees: number,
): BudgetDoc {
  const category = doc.categories.find((c) => c.name === categoryName)
  if (!category) return doc
  return {
    ...doc,
    templateLines: doc.templateLines.map((line) =>
      line.categoryId === category.id
        ? {
            ...line,
            versions: line.versions.map((v, i) =>
              i === 0 ? { ...v, amount: toPaise(rupees) } : v,
            ),
          }
        : line,
    ),
  }
}
