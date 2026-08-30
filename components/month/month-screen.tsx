'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { GroupSection } from '@/components/month/group-section'
import { LineRow } from '@/components/month/line-row'
import { MonthSwitcher, switcherRange } from '@/components/month/month-switcher'
import { NewLineRow } from '@/components/month/new-line-row'
import { Headline } from '@/components/month/headline'
import {
  EditScopeDrawer,
  type PendingEdit,
} from '@/components/month/edit-scope-drawer'
import { ImpactBar } from '@/components/impact-bar'
import { compareMonth, currentMonth, formatMonthLabel } from '@/lib/domain/month'
import {
  addCategory,
  clearOverride,
  renameCategory,
  setLineAmount,
  type EditScope,
} from '@/lib/domain/mutations'
import { useMonthView } from '@/lib/state/selectors'
import { useBudget } from '@/lib/state/store'
import { useUi } from '@/lib/state/ui-store'
import type { Paise, ResolvedLine } from '@/lib/domain/types'

export function MonthScreen() {
  const doc = useBudget((s) => s.doc)
  const apply = useBudget((s) => s.apply)
  const selectedMonth = useUi((s) => s.selectedMonth)
  const setSelectedMonth = useUi((s) => s.setSelectedMonth)

  const view = useMonthView(selectedMonth)
  const [pending, setPending] = useState<PendingEdit | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)

  const months = useMemo(
    () => (doc ? switcherRange(doc.settings.startMonth) : []),
    [doc],
  )

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

  function renderLine(line: ResolvedLine) {
    return (
      <LineRow
        key={line.lineId}
        line={line}
        frozen={frozen}
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

      <div className="mt-6 space-y-3">
        <GroupSection
          name="Income"
          subtotal={incomeTotal}
          onAdd={frozen ? undefined : () => setAddingTo('__income__')}
        >
          {income.map(renderLine)}
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
            {group.lines.map(renderLine)}
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
