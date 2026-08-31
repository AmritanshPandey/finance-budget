'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { GroupSection } from '@/components/month/group-section'
import { LineRow } from '@/components/month/line-row'
import { MonthSwitcher, switcherRange } from '@/components/month/month-switcher'
import { NewLineRow } from '@/components/month/new-line-row'
import { Headline } from '@/components/month/headline'
import { WhatsComing } from '@/components/month/whats-coming'
import {
  EditScopeDrawer,
  type PendingEdit,
} from '@/components/month/edit-scope-drawer'
import { ImpactBar } from '@/components/impact-bar'
import { compareMonth, currentMonth, formatMonthLabel } from '@/lib/domain/month'
import { formatINR } from '@/lib/domain/money'
import { planFromVersions } from '@/lib/domain/plan'
import {
  addCategory,
  clearOverride,
  renameCategory,
  setLineAmount,
  setLinePlan,
  type EditScope,
} from '@/lib/domain/mutations'
import { useMonthView } from '@/lib/state/selectors'
import { useBudget } from '@/lib/state/store'
import { useUi } from '@/lib/state/ui-store'
import type { Paise, ResolvedLine } from '@/lib/domain/types'

export function MonthScreen() {
  const doc = useBudget((s) => s.doc)
  const apply = useBudget((s) => s.apply)
  const rawSelectedMonth = useUi((s) => s.selectedMonth)
  const setSelectedMonth = useUi((s) => s.setSelectedMonth)

  /**
   * A plan can legitimately begin in the future. Opening on a month before it
   * starts would show a screen of zeroes and look broken, so fall forward to
   * the first month that actually has a plan.
   */
  const startMonth = doc?.settings.startMonth
  const selectedMonth =
    startMonth && compareMonth(rawSelectedMonth, startMonth) < 0 ? startMonth : rawSelectedMonth

  const view = useMonthView(selectedMonth)
  const [pending, setPending] = useState<PendingEdit | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)

  const months = useMemo(
    () => (doc ? switcherRange(doc.settings.startMonth) : []),
    [doc],
  )

  /**
   * A slider track is only useful if it is scaled to its neighbours. One global
   * maximum lets a ₹78,000 EMI squash every other line into the first inch, so
   * each group gets its own scale.
   */
  const sliderMaxByGroup = useMemo(() => {
    const scales = new Map<string, number>()
    if (!view) return scales
    scales.set('__income__', Math.max(Math.round(view.incomeTotal * 1.6), 10_000_00))
    for (const group of view.expenseGroups) {
      const biggest = group.lines.reduce((max, l) => Math.max(max, l.amount), 0)
      scales.set(group.id, Math.max(Math.round(biggest * 1.6), 10_000_00))
    }
    return scales
  }, [view])

  if (!doc || !view) return null

  const { resolved, income, incomeTotal, expenseGroups } = view
  const frozen = resolved.frozen
  const isFuture = compareMonth(selectedMonth, currentMonth()) > 0

  function commitAmount(lineId: string, amount: Paise, scope: EditScope, previous: Paise) {
    apply((d) => setLineAmount(d, selectedMonth, lineId, amount, scope))
    if (scope === 'future') {
      toast('Changed from ' + formatMonthLabel(selectedMonth) + ' onward', {
        action: {
          label: 'Undo',
          onClick: () =>
            apply((d) => setLineAmount(d, selectedMonth, lineId, previous, 'future')),
        },
      })
    }
  }

  function handleAmountChange(line: ResolvedLine, amount: Paise) {
    if (frozen) return

    // An EMI is derived from the loan, so there is no plan to revise — varying
    // it (a prepayment, a month skipped) only ever affects this one month.
    if (line.loanId) {
      apply((d) => setLineAmount(d, selectedMonth, line.lineId, amount, 'month'))
      toast(`${line.categoryName} changed for ${formatMonthLabel(selectedMonth)} only`, {
        action: {
          label: 'Undo',
          onClick: () => apply((d) => clearOverride(d, selectedMonth, line.lineId)),
        },
      })
      return
    }

    // A future month is a plan you are revising — ask what the change means.
    if (isFuture) {
      setPending({
        lineId: line.lineId,
        name: line.categoryName,
        amount,
        previous: line.amount,
        month: selectedMonth,
      })
      return
    }
    // The current month is where you live: carry it forward, offer an undo.
    commitAmount(line.lineId, amount, 'future', line.amount)
  }

  function renderLine(line: ResolvedLine, groupKey: string) {
    const category = doc?.categories.find((c) => c.id === line.categoryId)
    // Loan lines are derived from the loan, so they have no cadence to plan.
    const templateLine = doc?.templateLines.find((l) => l.id === line.lineId)
    return (
      <LineRow
        key={line.lineId}
        line={line}
        frozen={frozen}
        color={category?.color}
        icon={category?.icon}
        sliderMax={sliderMaxByGroup.get(groupKey) ?? 10_000_00}
        plan={templateLine ? planFromVersions(templateLine.versions) : null}
        horizonMonths={doc?.settings.horizonMonths ?? 120}
        onPlanChange={(next) =>
          apply((d) => setLinePlan(d, line.lineId, next, line.categoryName))
        }
        onAmountChange={(amount) => handleAmountChange(line, amount)}
        onRename={(name) => apply((d) => renameCategory(d, line.categoryId, name))}
        onClearOverride={() =>
          apply((d) => clearOverride(d, selectedMonth, line.lineId))
        }
      />
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-40 pt-safe md:pb-32">
      <header className="sticky top-0 z-20 -mx-4 bg-background/95 px-4 pb-2 pt-3 backdrop-blur">
        <MonthSwitcher
          months={months}
          selected={selectedMonth}
          onSelect={setSelectedMonth}
        />
      </header>

      <Headline
        surplus={resolved.surplus}
        target={doc.settings.monthlySavingTarget}
        income={resolved.income}
        expenses={resolved.expenses + resolved.emis}
        investments={resolved.investments}
        frozen={frozen}
      />

      <section className="mt-5 rounded-3xl border bg-card p-4">
        <p className="label-xs">Estimated monthly income</p>
        <p className="num-xl mt-1">{formatINR(incomeTotal)}</p>
      </section>

      <div className="mt-3 space-y-3">
        <GroupSection
          name="Income"
          subtotal={incomeTotal}
          defaultOpen={false}
          onAdd={frozen ? undefined : () => setAddingTo('__income__')}
        >
          {income.map((line) => renderLine(line, '__income__'))}
          {addingTo === '__income__' && (
            <NewLineRow
              onCancel={() => setAddingTo(null)}
              onAdd={(name, amount) => {
                apply((d) =>
                  addCategory(d, {
                    name,
                    kind: 'income',
                    groupId: d.groups[0]?.id ?? '',
                    amount,
                    from: selectedMonth,
                  }),
                )
                setAddingTo(null)
              }}
            />
          )}
          {income.length === 0 && addingTo !== '__income__' && <Empty />}
        </GroupSection>

        {expenseGroups.map((group) => (
          <GroupSection
            key={group.id}
            name={group.name}
            subtotal={group.subtotal}
            muted={group.derived}
            onAdd={frozen || group.derived ? undefined : () => setAddingTo(group.id)}
          >
            {group.lines.map((line) => renderLine(line, group.id))}
            {addingTo === group.id && (
              <NewLineRow
                onCancel={() => setAddingTo(null)}
                onAdd={(name, amount) => {
                  apply((d) =>
                    addCategory(d, {
                      name,
                      kind: 'expense',
                      groupId: group.id,
                      amount,
                      from: selectedMonth,
                    }),
                  )
                  setAddingTo(null)
                }}
              />
            )}
          </GroupSection>
        ))}
      </div>

      <div className="mt-3">
        <WhatsComing doc={doc} />
      </div>

      {frozen && (
        <p className="mt-5 text-center text-xs text-muted-foreground">
          {formatMonthLabel(selectedMonth)} is closed. Past months are kept exactly as
          they were planned.
        </p>
      )}

      <EditScopeDrawer
        edit={pending}
        onCancel={() => setPending(null)}
        onResolve={(scope) => {
          if (pending) commitAmount(pending.lineId, pending.amount, scope, pending.previous)
          setPending(null)
        }}
      />

      <ImpactBar />
    </div>
  )
}

function Empty() {
  return (
    <p className="px-2 py-3 text-sm text-muted-foreground">Nothing here yet.</p>
  )
}
