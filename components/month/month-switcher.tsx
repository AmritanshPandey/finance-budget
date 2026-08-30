'use client'

import { useEffect, useRef } from 'react'

import {
  addMonths,
  compareMonth,
  currentMonth,
  formatMonthShort,
  isJanuary,
} from '@/lib/domain/month'
import type { ISOMonth } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

export function MonthSwitcher({
  months,
  selected,
  onSelect,
}: {
  months: ISOMonth[]
  selected: ISOMonth
  onSelect: (month: ISOMonth) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [selected])

  const now = currentMonth()

  return (
    <div
      ref={scroller}
      className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {months.map((month) => {
        const active = month === selected
        const past = compareMonth(month, now) < 0
        return (
          <button
            key={month}
            ref={active ? activeRef : undefined}
            onClick={() => onSelect(month)}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              active && 'bg-primary text-primary-foreground',
              !active && past && 'text-muted-foreground/60 hover:bg-accent',
              !active && !past && 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {formatMonthShort(month)}
            {(isJanuary(month) || month === months[0]) && (
              <span className={cn('ml-1 text-xs', active ? 'opacity-80' : 'opacity-60')}>
                {month.slice(2, 4)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** A year back, three years forward — never before the plan itself starts. */
export function switcherRange(startMonth: ISOMonth, now = currentMonth()): ISOMonth[] {
  let first = addMonths(now, -12)
  if (compareMonth(first, startMonth) < 0) first = startMonth
  const out: ISOMonth[] = []
  for (let m = first; compareMonth(m, addMonths(now, 36)) <= 0; m = addMonths(m, 1)) {
    out.push(m)
  }
  return out
}
