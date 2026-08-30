/**
 * The storage seam. Everything the app knows lives behind this interface, so a
 * sync backend can be added later without touching a single feature.
 */

import type { BudgetDoc } from '@/lib/domain/types'

export interface BudgetStorage {
  load(): Promise<BudgetDoc | null>
  save(doc: BudgetDoc): Promise<void>
  clear(): Promise<void>
}

/** Used during SSR and in tests, where there is no IndexedDB. */
export class MemoryStorage implements BudgetStorage {
  private doc: BudgetDoc | null = null

  async load() {
    return this.doc
  }

  async save(doc: BudgetDoc) {
    this.doc = doc
  }

  async clear() {
    this.doc = null
  }
}
