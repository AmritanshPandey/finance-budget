/**
 * Pure document mutations. Every one takes a document and returns a new one —
 * no storage, no React. The store is a thin wrapper that applies these and
 * persists the result.
 */

import { addCategory as addCategoryToDoc } from './factory'
import { newId } from './id'
import { compareMonth } from './month'
import { versionInForce } from './resolve-month'
import type {
  BalanceCheck,
  BudgetDoc,
  Category,
  CategoryGroup,
  Goal,
  ISODate,
  ISOMonth,
  LineKind,
  Loan,
  OneOff,
  Paise,
  Settings,
  TemplateLine,
} from './types'

export type EditScope = 'month' | 'future'

// ---------------------------------------------------------------------------
// Amounts
// ---------------------------------------------------------------------------

/**
 * The core edit. `month` scope writes a one-month override; `future` scope adds
 * a new version to the template line and clears any overrides it would shadow.
 */
export function setLineAmount(
  doc: BudgetDoc,
  month: ISOMonth,
  lineId: string,
  amount: Paise,
  scope: EditScope,
  label?: string,
): BudgetDoc {
  const line = doc.templateLines.find((l) => l.id === lineId)
  if (!line) return doc

  if (scope === 'month') {
    const others = doc.overrides.filter(
      (o) => !(o.month === month && o.lineId === lineId),
    )
    return { ...doc, overrides: [...others, { month, lineId, amount }] }
  }

  const current = versionInForce(line.versions, month)
  const versions = line.versions.filter((v) => v.from !== month)
  versions.push({
    from: month,
    amount,
    growthRatePct: current?.growthRatePct,
    label,
  })
  versions.sort((a, b) => compareMonth(a.from, b.from))

  return {
    ...doc,
    templateLines: doc.templateLines.map((l) => (l.id === lineId ? { ...l, versions } : l)),
    // Overrides from this month on would shadow the change the user just made.
    overrides: doc.overrides.filter(
      (o) => o.lineId !== lineId || compareMonth(o.month, month) < 0,
    ),
  }
}

/** Drop a one-month override, returning the month to the plan. */
export function clearOverride(
  doc: BudgetDoc,
  month: ISOMonth,
  lineId: string,
): BudgetDoc {
  return {
    ...doc,
    overrides: doc.overrides.filter((o) => !(o.month === month && o.lineId === lineId)),
  }
}

export function setLineGrowthRate(
  doc: BudgetDoc,
  lineId: string,
  month: ISOMonth,
  growthRatePct: number | undefined,
): BudgetDoc {
  return {
    ...doc,
    templateLines: doc.templateLines.map((line) => {
      if (line.id !== lineId) return line
      const active = versionInForce(line.versions, month)
      if (!active) return line
      return {
        ...line,
        versions: line.versions.map((v) =>
          v.from === active.from ? { ...v, growthRatePct } : v,
        ),
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// Categories and groups
// ---------------------------------------------------------------------------

export function addCategory(
  doc: BudgetDoc,
  input: {
    name: string
    kind: LineKind
    groupId: string
    amount?: Paise
    from?: ISOMonth
  },
): BudgetDoc {
  return addCategoryToDoc(doc, input)
}

export function renameCategory(doc: BudgetDoc, categoryId: string, name: string): BudgetDoc {
  return {
    ...doc,
    categories: doc.categories.map((c) => (c.id === categoryId ? { ...c, name } : c)),
  }
}

/** Archive, never delete — historical months must still resolve the name. */
export function archiveCategory(
  doc: BudgetDoc,
  categoryId: string,
  today: ISODate,
): BudgetDoc {
  return {
    ...doc,
    categories: doc.categories.map((c) =>
      c.id === categoryId ? { ...c, archivedAt: today } : c,
    ),
  }
}

export function restoreCategory(doc: BudgetDoc, categoryId: string): BudgetDoc {
  return {
    ...doc,
    categories: doc.categories.map((c): Category => {
      if (c.id !== categoryId) return c
      return {
        id: c.id,
        groupId: c.groupId,
        name: c.name,
        kind: c.kind,
        order: c.order,
        inflatable: c.inflatable,
      }
    }),
  }
}

export function moveCategoryToGroup(
  doc: BudgetDoc,
  categoryId: string,
  groupId: string,
): BudgetDoc {
  const siblings = doc.categories.filter(
    (c) => c.groupId === groupId && c.id !== categoryId,
  )
  return {
    ...doc,
    categories: doc.categories.map((c) =>
      c.id === categoryId ? { ...c, groupId, order: siblings.length } : c,
    ),
  }
}

/** Apply a new order to the categories of one group. */
export function reorderCategories(
  doc: BudgetDoc,
  groupId: string,
  orderedIds: string[],
): BudgetDoc {
  const rank = new Map(orderedIds.map((id, index) => [id, index]))
  return {
    ...doc,
    categories: doc.categories.map((c) =>
      c.groupId === groupId && rank.has(c.id) ? { ...c, order: rank.get(c.id) as number } : c,
    ),
  }
}

export function addGroup(doc: BudgetDoc, name: string): BudgetDoc {
  const group: CategoryGroup = { id: newId('grp'), name, order: doc.groups.length }
  return { ...doc, groups: [...doc.groups, group] }
}

export function renameGroup(doc: BudgetDoc, groupId: string, name: string): BudgetDoc {
  return {
    ...doc,
    groups: doc.groups.map((g) => (g.id === groupId ? { ...g, name } : g)),
  }
}

export function reorderGroups(doc: BudgetDoc, orderedIds: string[]): BudgetDoc {
  const rank = new Map(orderedIds.map((id, index) => [id, index]))
  return {
    ...doc,
    groups: doc.groups.map((g) =>
      rank.has(g.id) ? { ...g, order: rank.get(g.id) as number } : g,
    ),
  }
}

/** Archiving a group archives everything in it. */
export function archiveGroup(doc: BudgetDoc, groupId: string, today: ISODate): BudgetDoc {
  return {
    ...doc,
    groups: doc.groups.map((g) => (g.id === groupId ? { ...g, archivedAt: today } : g)),
    categories: doc.categories.map((c) =>
      c.groupId === groupId ? { ...c, archivedAt: c.archivedAt ?? today } : c,
    ),
  }
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export function addGoal(doc: BudgetDoc, goal: Omit<Goal, 'id' | 'priority' | 'status'>): BudgetDoc {
  const next: Goal = {
    ...goal,
    id: newId('goal'),
    priority: doc.goals.length,
    status: 'active',
  }
  return { ...doc, goals: [...doc.goals, next] }
}

export function updateGoal(doc: BudgetDoc, goalId: string, patch: Partial<Goal>): BudgetDoc {
  return {
    ...doc,
    goals: doc.goals.map((g) => (g.id === goalId ? { ...g, ...patch, id: g.id } : g)),
  }
}

export function removeGoal(doc: BudgetDoc, goalId: string): BudgetDoc {
  return {
    ...doc,
    goals: doc.goals.filter((g) => g.id !== goalId),
    loans: doc.loans.filter((l) => l.goalId !== goalId),
  }
}

export function reorderGoals(doc: BudgetDoc, orderedIds: string[]): BudgetDoc {
  const rank = new Map(orderedIds.map((id, index) => [id, index]))
  return {
    ...doc,
    goals: doc.goals.map((g) =>
      rank.has(g.id) ? { ...g, priority: rank.get(g.id) as number } : g,
    ),
  }
}

// ---------------------------------------------------------------------------
// Loans, one-offs, balance checks, settings
// ---------------------------------------------------------------------------

export function addLoan(doc: BudgetDoc, loan: Omit<Loan, 'id'>): BudgetDoc {
  return { ...doc, loans: [...doc.loans, { ...loan, id: newId('loan') }] }
}

export function updateLoan(doc: BudgetDoc, loanId: string, patch: Partial<Loan>): BudgetDoc {
  return {
    ...doc,
    loans: doc.loans.map((l) => (l.id === loanId ? { ...l, ...patch, id: l.id } : l)),
  }
}

export function removeLoan(doc: BudgetDoc, loanId: string): BudgetDoc {
  return { ...doc, loans: doc.loans.filter((l) => l.id !== loanId) }
}

export function addOneOff(doc: BudgetDoc, oneOff: Omit<OneOff, 'id'>): BudgetDoc {
  return { ...doc, oneOffs: [...doc.oneOffs, { ...oneOff, id: newId('one') }] }
}

export function removeOneOff(doc: BudgetDoc, oneOffId: string): BudgetDoc {
  return { ...doc, oneOffs: doc.oneOffs.filter((o) => o.id !== oneOffId) }
}

export function recordBalanceCheck(
  doc: BudgetDoc,
  check: Omit<BalanceCheck, 'id'>,
): BudgetDoc {
  const entry: BalanceCheck = { ...check, id: newId('bal') }
  return { ...doc, balanceChecks: [...doc.balanceChecks, entry] }
}

export function updateSettings(doc: BudgetDoc, patch: Partial<Settings>): BudgetDoc {
  return { ...doc, settings: { ...doc.settings, ...patch } }
}

/** The template line belonging to a category, if any. */
export function lineForCategory(
  doc: BudgetDoc,
  categoryId: string,
): TemplateLine | undefined {
  return doc.templateLines.find((l) => l.categoryId === categoryId)
}
