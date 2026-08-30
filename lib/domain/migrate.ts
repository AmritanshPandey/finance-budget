/**
 * Bringing a stored document up to the current shape.
 *
 * Documents are written to IndexedDB and can be exported to JSON and re-imported
 * months later, so anything read from outside has to be treated as possibly
 * older than the code reading it.
 */

import { DEFAULT_SETTINGS } from './factory'
import { inferLook } from './look'
import type { BudgetDoc } from './types'

export function migrate(stored: BudgetDoc): BudgetDoc {
  return {
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
}
