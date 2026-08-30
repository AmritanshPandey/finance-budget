'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { IconArrowRight, IconPlus } from '@tabler/icons-react'

import { CategoryIcon } from '@/components/category-icon'
import { QuickAddDrawer } from '@/components/transactions/quick-add-drawer'
import { monthActuals, recentTransactions } from '@/lib/domain/actuals'
import { describeOutcome } from '@/lib/domain/goals'
import { loanEMI } from '@/lib/domain/loan'
import { currentMonth, formatMonthLabel } from '@/lib/domain/month'
import { formatCompactINR, formatINR } from '@/lib/domain/money'
import { projectedMonth } from '@/lib/domain/projection'
import { resolveMonth } from '@/lib/domain/resolve-month'
import { useBudget } from '@/lib/state/store'
import { cn } from '@/lib/utils'
import type { BudgetDoc, Paise } from '@/lib/domain/types'

export function OverviewScreen() {
  const doc = useBudget((s) => s.doc)
  const projection = useBudget((s) => s.projection)
  const [adding, setAdding] = useState(false)

  const month = currentMonth()
  const view = useMemo(() => (doc ? resolveMonth(doc, month) : null), [doc, month])
  const actual = useMemo(() => (doc ? monthActuals(doc, month) : null), [doc, month])
  const recent = useMemo(() => (doc ? recentTransactions(doc, 6) : []), [doc])

  if (!doc || !view || !actual || !projection) return null

  const now = projectedMonth(projection, month)
  const available = now?.netWorth ?? projection.originBalance
  const planned = view.expenses + view.emis
  const spent = actual.spent
  const pct = planned > 0 ? Math.min(1, spent / planned) : 0

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-safe">
      <header className="flex items-center justify-between gap-3 pb-4 pt-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Financial health</h1>
          <p className="text-xs text-muted-foreground">{formatMonthLabel(month)}</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <IconPlus size={16} stroke={2.4} />
          Log
        </button>
      </header>

      {/* The hero. One loud card, everything else recedes. */}
      <section className="rounded-3xl bg-primary p-5 text-primary-foreground">
        <span className="inline-flex rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
          Active budget plan
        </span>
        <p className="mt-4 text-sm font-medium opacity-80">Total available</p>
        <p className="num-hero mt-1">{formatINR(available)}</p>

        <p className="mt-4 text-sm font-medium opacity-90">
          Spent this month: <span className="tnum">{formatINR(spent)}</span> /{' '}
          <span className="tnum">{formatINR(planned)}</span> ({Math.round(pct * 100)}%)
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary-foreground/20">
          <div
            className="h-full rounded-full bg-primary-foreground transition-[width] duration-500"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </section>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <BillsDueCard doc={doc} />
        <TopGoalCard available={available} />
      </div>

      <section className="mt-3 rounded-3xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Recent spending</h2>
          <Link
            href="/analytics"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            All <IconArrowRight size={13} stroke={2.2} />
          </Link>
        </div>

        {recent.length === 0 ? (
          <button
            onClick={() => setAdding(true)}
            className="mt-4 w-full rounded-2xl border border-dashed py-6 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Nothing logged yet. Add your first spend.
          </button>
        ) : (
          <ul className="mt-3 space-y-1">
            {recent.map((tx) => {
              const category = doc.categories.find((c) => c.id === tx.categoryId)
              return (
                <li key={tx.id} className="flex items-center gap-3 py-1.5">
                  <CategoryIcon
                    name={category?.name ?? tx.merchant}
                    icon={category?.icon}
                    color={category?.color}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {tx.merchant || category?.name || 'Spending'}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {category?.name} · {tx.date.slice(8, 10)}/{tx.date.slice(5, 7)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'num-md shrink-0',
                      tx.direction === 'in' ? 'text-positive' : 'text-foreground',
                    )}
                  >
                    {tx.direction === 'in' ? '+' : '−'}
                    {formatINR(tx.amount)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <QuickAddDrawer open={adding} onOpenChange={setAdding} />
    </div>
  )
}

/** Categories carrying a due day, plus the loans, whichever lands soonest. */
function BillsDueCard({ doc }: { doc: BudgetDoc }) {
  const today = new Date()
  const month = currentMonth()
  const view = resolveMonth(doc, month)

  const dated = doc.categories
    .filter((c) => !c.archivedAt && c.dueDay && c.kind !== 'income')
    .map((c) => {
      const line = view.lines.find((l) => l.categoryId === c.id)
      const daysAway = ((c.dueDay as number) - today.getDate() + 31) % 31
      return { name: c.name, amount: line?.amount ?? 0, dueDay: c.dueDay as number, daysAway }
    })
    .sort((a, b) => a.daysAway - b.daysAway)

  const next = dated[0]
  const emiTotal = doc.loans.reduce((a, l) => a + loanEMI(l), 0)

  return (
    <section className="rounded-3xl border bg-card p-4">
      <h2 className="text-sm font-semibold tracking-tight">Bills due soon</h2>
      {next ? (
        <>
          <p className="mt-3 text-sm text-muted-foreground">{next.name}</p>
          <p className="num-lg mt-0.5">{formatINR(next.amount)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {next.daysAway === 0 ? 'Due today' : `Due in ${next.daysAway} days`}
          </p>
        </>
      ) : emiTotal > 0 ? (
        <>
          <p className="mt-3 text-sm text-muted-foreground">Loan payments</p>
          <p className="num-lg mt-0.5">{formatINR(emiTotal)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Every month</p>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Add a due day to a bill in Setup and it will show up here.
        </p>
      )}
    </section>
  )
}

function TopGoalCard({ available }: { available: Paise }) {
  const projection = useBudget((s) => s.projection)
  const doc = useBudget((s) => s.doc)

  const goal = [...(doc?.goals ?? [])]
    .filter((g) => g.status === 'active')
    .sort((a, b) => a.priority - b.priority)[0]

  if (!goal) {
    return (
      <section className="rounded-3xl border bg-card p-4">
        <h2 className="text-sm font-semibold tracking-tight">Top goal</h2>
        <Link href="/goals" className="mt-3 block text-xs text-muted-foreground hover:text-foreground">
          Nothing set yet. Pick something to save towards.
        </Link>
      </section>
    )
  }

  const outcome = projection?.goalOutcomes.find((o) => o.goalId === goal.id)
  const saved = Math.max(0, Math.min(available, goal.targetAmount))
  const pct = goal.targetAmount > 0 ? saved / goal.targetAmount : 0

  return (
    <Link href="/goals" className="block rounded-3xl border bg-card p-4">
      <h2 className="text-sm font-semibold tracking-tight">Top goal</h2>
      <p className="mt-3 truncate text-sm text-muted-foreground">
        {goal.emoji} {goal.name}
      </p>
      <p className="num-lg mt-0.5">{formatCompactINR(saved)}</p>
      <p className="text-xs text-muted-foreground">
        of <span className="tnum">{formatCompactINR(goal.targetAmount)}</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full',
            outcome?.status === 'unreachable'
              ? 'bg-negative'
              : outcome?.status === 'late'
                ? 'bg-warn'
                : 'bg-primary',
          )}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      {outcome && (
        <p className="mt-1.5 truncate text-xs text-muted-foreground">{describeOutcome(outcome)}</p>
      )}
    </Link>
  )
}
