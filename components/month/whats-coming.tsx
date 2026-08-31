'use client'

import { useMemo, useState } from 'react'
import {
  IconArrowBackUp,
  IconCalendarRepeat,
  IconChevronRight,
  IconCircleDot,
  IconTrendingDown,
  IconTrendingUp,
  IconX,
} from '@tabler/icons-react'

import { CategoryIcon } from '@/components/category-icon'
import { clearOverride, removeLoan, removeOneOff } from '@/lib/domain/mutations'
import { currentMonth, formatMonthLabel } from '@/lib/domain/month'
import { scheduledChanges, type ScheduledChange } from '@/lib/domain/schedule'
import { useBudget } from '@/lib/state/store'
import { useUi } from '@/lib/state/ui-store'
import { cn } from '@/lib/utils'
import type { BudgetDoc } from '@/lib/domain/types'

const ICONS = {
  change: IconTrendingUp,
  ends: IconTrendingDown,
  starts: IconCircleDot,
  loanStart: IconCalendarRepeat,
  loanEnd: IconTrendingDown,
  oneOff: IconCircleDot,
  override: IconArrowBackUp,
} as const

/**
 * Everything already planned to happen, in date order. Derived from the
 * document rather than stored, so it can never drift from the forecast.
 */
export function WhatsComing({ doc }: { doc: BudgetDoc }) {
  const apply = useBudget((s) => s.apply)
  const setSelectedMonth = useUi((s) => s.setSelectedMonth)
  const [expanded, setExpanded] = useState(false)

  const now = currentMonth()
  const changes = useMemo(() => scheduledChanges(doc, now), [doc, now])
  const shown = expanded ? changes : changes.slice(0, 5)

  function remove(change: ScheduledChange) {
    if (change.oneOffId) apply((d) => removeOneOff(d, change.oneOffId as string))
    else if (change.loanId) apply((d) => removeLoan(d, change.loanId as string))
    else if (change.kind === 'override' && change.lineId) {
      apply((d) => clearOverride(d, change.month, change.lineId as string))
    }
  }

  return (
    <section className="rounded-3xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">What&rsquo;s coming</h2>
        <span className="text-xs text-muted-foreground">
          {changes.length === 0 ? 'nothing yet' : `${changes.length} scheduled`}
        </span>
      </div>

      {changes.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing is scheduled to change. Set a line to climb, change or stop, add a loan, or plan
          one-off money, and it will show up here.
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-0.5">
            {shown.map((change) => {
              const Icon = ICONS[change.kind]
              const category = doc.categories.find((c) => c.id === change.categoryId)
              const removable = Boolean(
                change.oneOffId || change.loanId || change.kind === 'override',
              )
              return (
                <li key={change.id} className="flex items-center gap-2.5 py-1.5">
                  {category ? (
                    <CategoryIcon
                      name={category.name}
                      icon={category.icon}
                      color={category.color}
                      size="sm"
                    />
                  ) : (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon size={14} stroke={2} />
                    </span>
                  )}

                  <button
                    onClick={() => setSelectedMonth(change.month)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-medium">{change.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {change.detail}
                    </span>
                  </button>

                  <button
                    onClick={() => setSelectedMonth(change.month)}
                    className={cn(
                      'shrink-0 rounded-full px-2 py-1 text-xs font-medium tnum transition-colors',
                      'bg-muted text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {formatMonthLabel(change.month)}
                  </button>

                  {removable && (
                    <button
                      onClick={() => remove(change)}
                      aria-label={`Remove ${change.title}`}
                      className="-m-1 shrink-0 rounded-md p-2.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <IconX size={13} stroke={2.2} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>

          {changes.length > 5 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-2 flex w-full items-center justify-center gap-1 py-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              {expanded ? 'Show less' : `Show all ${changes.length}`}
              <IconChevronRight
                size={13}
                className={cn('transition-transform', expanded && '-rotate-90')}
              />
            </button>
          )}
        </>
      )}
    </section>
  )
}
