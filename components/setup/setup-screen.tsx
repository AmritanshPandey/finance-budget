'use client'

import { AssumptionsSection } from '@/components/setup/assumptions-section'
import { BalanceCheckSection } from '@/components/setup/balance-check-section'
import { CategoriesSection } from '@/components/setup/categories-section'
import { DataSection } from '@/components/setup/data-section'
import { GoalsSection } from '@/components/setup/goals-section'
import { LoansSection } from '@/components/setup/loans-section'
import { OneOffsSection } from '@/components/setup/one-offs-section'
import { useBudget } from '@/lib/state/store'

export function SetupScreen() {
  const doc = useBudget((s) => s.doc)
  if (!doc) return null

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-28 pt-safe">
      <header className="pb-1 pt-4">
        <h1 className="text-lg font-semibold tracking-tight">Setup</h1>
        <p className="text-xs text-muted-foreground">
          The shape of your plan, and the few numbers behind it.
        </p>
      </header>

      <GoalsSection doc={doc} />
      <BalanceCheckSection doc={doc} />
      <OneOffsSection doc={doc} />
      <LoansSection doc={doc} />
      <AssumptionsSection doc={doc} />
      <CategoriesSection doc={doc} />
      <DataSection />
    </div>
  )
}
