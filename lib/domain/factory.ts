/**
 * Building a document. Used by onboarding and by tests — the seeded categories
 * are only a starting point; every one of them is renameable, movable and
 * archivable.
 */

import { newId } from './id'
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

interface SeedCategory {
  name: string
  kind: LineKind
  group: string
  inflatable: boolean
  /** Rent rises faster than general inflation in most Indian cities. */
  growthRatePct?: number
}

const SEED_GROUPS = ['Income', 'Living', 'Daily', 'Lifestyle'] as const

const SEED_CATEGORIES: SeedCategory[] = [
  { name: 'Salary', kind: 'income', group: 'Income', inflatable: false },
  { name: 'Rent', kind: 'expense', group: 'Living', inflatable: false, growthRatePct: 8 },
  { name: 'Utilities', kind: 'expense', group: 'Living', inflatable: true },
  { name: 'Food', kind: 'expense', group: 'Daily', inflatable: true },
  { name: 'Transport', kind: 'expense', group: 'Daily', inflatable: true },
  { name: 'Subscriptions', kind: 'expense', group: 'Lifestyle', inflatable: false },
  { name: 'Other', kind: 'expense', group: 'Lifestyle', inflatable: true },
]

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
  }))

  const templateLines: TemplateLine[] = categories.map((category, index) => ({
    id: newId('line'),
    categoryId: category.id,
    versions: [
      {
        from: startMonth,
        amount: 0,
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
