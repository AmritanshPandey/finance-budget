/**
 * Bringing a stored document up to the current shape.
 *
 * Documents are written to IndexedDB and can be exported to JSON and re-imported
 * months later, so anything read from outside has to be treated as possibly
 * older than the code reading it.
 */

import { DEFAULT_SETTINGS } from './factory'
import { inferLook } from './look'
import { CURRENT_VERSION, type BudgetDoc } from './types'

/**
 * Version 1 applied yearly increases by default — 6% to most spending, 8% to
 * rent, 5% to pay, 6% to savings — which meant a plan quietly grew without
 * anyone asking it to. Version 2 turns all of that off.
 *
 * A rate the user has set deliberately since is left alone; this only runs once,
 * on documents written before the change.
 */
function stopAutomaticIncreases(doc: BudgetDoc): BudgetDoc {
  return {
    ...doc,
    settings: {
      ...doc.settings,
      inflationRatePct: 0,
      incomeGrowthRatePct: 0,
      expectedAnnualReturnPct: 0,
    },
    templateLines: doc.templateLines.map((line) => ({
      ...line,
      // Dated changes are deliberate and stay; it is only the rates that go.
      versions: line.versions.map((v) => ({ ...v, growthRatePct: 0 })),
    })),
  }
}

export function migrate(stored: BudgetDoc): BudgetDoc {
  const filled: BudgetDoc = {
    ...stored,
    settings: { ...DEFAULT_SETTINGS, ...stored.settings },
    groups: stored.groups ?? [],
    categories: (stored.categories ?? []).map((c) =>
      // Fill in a look without overwriting one the user chose.
      c.icon && c.color ? c : { ...inferLook(c.name), ...c },
    ),
    templateLines: stored.templateLines ?? [],
    overrides: stored.overrides ?? [],
    snapshots: stored.snapshots ?? [],
    loans: stored.loans ?? [],
    goals: stored.goals ?? [],
    oneOffs: stored.oneOffs ?? [],
    balanceChecks: stored.balanceChecks ?? [],
    transactions: stored.transactions ?? [],
    merchantMemory: stored.merchantMemory ?? {},
  }

  const upgraded = (stored.version ?? 1) < 2 ? stopAutomaticIncreases(filled) : filled
  return { ...upgraded, version: CURRENT_VERSION }
}
