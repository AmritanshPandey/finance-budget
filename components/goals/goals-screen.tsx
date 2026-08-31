'use client'

import { EditableHeading } from '@/components/editable-heading'
import { FutureScreen } from '@/components/future/future-screen'
import { GoalsSection } from '@/components/setup/goals-section'
import { useBudget } from '@/lib/state/store'

/**
 * Goals and the projection that decides them, on one screen. A goal without the
 * timeline beside it is a number with no meaning.
 */
export function GoalsScreen() {
  const doc = useBudget((s) => s.doc)
  if (!doc) return null

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 pb-28 pt-safe">
      <header className="pb-1 pt-4">
        <EditableHeading as="h1" labelKey="goals.title" className="text-xl font-semibold tracking-tight" />
        <p className="text-xs text-muted-foreground">
          Rank them, then watch where the money runs out.
        </p>
      </header>

      <GoalsSection doc={doc} />

      <section className="rounded-3xl border bg-card p-4">
        <FutureScreen embedded />
      </section>
    </div>
  )
}
