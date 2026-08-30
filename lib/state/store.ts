'use client'

import { create } from 'zustand'

import { DEFAULT_SETTINGS } from '@/lib/domain/factory'
import { freezePastMonths } from '@/lib/domain/freeze'
import { describeImpact, type Impact } from '@/lib/domain/goals'
import { currentMonth } from '@/lib/domain/month'
import { project } from '@/lib/domain/projection'
import type { BudgetDoc, Projection } from '@/lib/domain/types'
import { getStorage } from '@/lib/storage/indexeddb-storage'

export interface BudgetStore {
  doc: BudgetDoc | null
  projection: Projection | null
  hydrated: boolean
  /** The consequence of the most recent edit, for the impact bar. */
  impact: Impact | null

  hydrate: () => Promise<void>
  initialize: (doc: BudgetDoc) => void
  /** Apply a pure mutation, recompute the forecast, persist. */
  apply: (mutate: (doc: BudgetDoc) => BudgetDoc) => void
  clearImpact: () => void
  importDoc: (json: string) => { ok: true } | { ok: false; error: string }
  exportDoc: () => string
  reset: () => Promise<void>
}

function persist(doc: BudgetDoc) {
  void getStorage().save(doc)
}

export const useBudget = create<BudgetStore>((set, get) => ({
  doc: null,
  projection: null,
  hydrated: false,
  impact: null,

  async hydrate() {
    if (get().hydrated) return
    const stored = await getStorage().load()
    if (!stored) {
      set({ hydrated: true })
      return
    }
    // Fill in any setting added since this document was written, then write
    // down every month that has fallen into the past.
    const doc: BudgetDoc = {
      ...stored,
      settings: { ...DEFAULT_SETTINGS, ...stored.settings },
      snapshots: freezePastMonths(stored, currentMonth()),
    }
    set({ doc, projection: project(doc), hydrated: true })
    persist(doc)
  },

  initialize(doc) {
    set({ doc, projection: project(doc), hydrated: true, impact: null })
    persist(doc)
  },

  apply(mutate) {
    const { doc, projection } = get()
    if (!doc) return

    const next = mutate(doc)
    if (next === doc) return

    const nextProjection = project(next)
    const impact = projection ? describeImpact(projection, nextProjection) : null

    set({ doc: next, projection: nextProjection, impact })
    persist(next)
  },

  clearImpact() {
    set({ impact: null })
  },

  importDoc(json) {
    try {
      const parsed = JSON.parse(json) as BudgetDoc
      if (!parsed || parsed.version !== 1 || !parsed.settings) {
        return { ok: false, error: 'That file is not a budget export.' }
      }
      get().initialize(parsed)
      return { ok: true }
    } catch {
      return { ok: false, error: 'That file could not be read.' }
    }
  },

  exportDoc() {
    return JSON.stringify(get().doc, null, 2)
  },

  async reset() {
    await getStorage().clear()
    set({ doc: null, projection: null, impact: null, hydrated: true })
  },
}))
