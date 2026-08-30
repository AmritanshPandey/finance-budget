'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, TriangleAlert } from 'lucide-react'

import { buildRows, type TimelineRow } from '@/components/future/timeline-rows'
import { describeOutcome } from '@/lib/domain/goals'
import { formatMonthLabel, formatMonthShort } from '@/lib/domain/month'
import { formatCompactINR, formatINR } from '@/lib/domain/money'
import { useBudget } from '@/lib/state/store'
import { useUi } from '@/lib/state/ui-store'
import { cn } from '@/lib/utils'
import type { GoalOutcome, ProjectedMonth } from '@/lib/domain/types'

const RANGES = [
  { label: '1y', months: 12 },
  { label: '5y', months: 60 },
  { label: '10y', months: 120 },
]

export function FutureScreen() {
  const projection = useBudget((s) => s.projection)
  const rangeMonths = useUi((s) => s.rangeMonths)
  const setRangeMonths = useUi((s) => s.setRangeMonths)

  const months = useMemo(
    () => projection?.months.slice(0, rangeMonths) ?? [],
    [projection, rangeMonths],
  )
  const rows = useMemo(() => buildRows(months), [months])

  const scale = useMemo(() => {
    const peak = months.reduce((max, m) => Math.max(max, m.closingBalance), 1)
    return (value: number) => Math.max(0, Math.min(100, (value / peak) * 100))
  }, [months])

  if (!projection) return null

  const unreachable = projection.goalOutcomes.filter((o) => o.status === 'unreachable')

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-safe">
      <header className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 bg-background/95 px-4 pb-3 pt-4 backdrop-blur">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Future</h1>
          <p className="text-xs text-muted-foreground">Scroll down to go forward</p>
        </div>
        <div className="flex rounded-lg bg-muted p-0.5">
          {RANGES.map((range) => (
            <button
              key={range.label}
              onClick={() => setRangeMonths(range.months)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                rangeMonths === range.months
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </header>

      <ol className="space-y-1">
        {rows.map((row, index) => (
          <Row key={rowKey(row, index)} row={row} scale={scale} />
        ))}
      </ol>

      {unreachable.length > 0 && (
        <section className="mt-6 rounded-xl border border-negative/30 bg-negative-soft/50 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-negative">
            <TriangleAlert className="size-4" strokeWidth={2.2} />
            Out of reach
          </h2>
          <ul className="mt-2 space-y-1.5">
            {unreachable.map((goal) => (
              <li key={goal.goalId} className="text-sm">
                <span className="font-medium">
                  {goal.emoji} {goal.name}
                </span>{' '}
                <span className="text-muted-foreground">
                  — {formatINR(goal.targetAmount)} by {formatMonthLabel(goal.targetMonth)} is
                  not reachable on this plan.
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function rowKey(row: TimelineRow, index: number) {
  if (row.kind === 'year') return `y-${row.year}-${index}`
  if (row.kind === 'quiet') return `q-${row.months[0].month}`
  return `m-${row.month.month}`
}

function Row({ row, scale }: { row: TimelineRow; scale: (v: number) => number }) {
  if (row.kind === 'year') {
    return (
      <li className="flex items-center gap-3 pb-1 pt-5 first:pt-1">
        <span className="text-xs font-semibold tracking-widest text-muted-foreground">
          {row.year}
        </span>
        <span className="h-px flex-1 bg-border" />
      </li>
    )
  }

  if (row.kind === 'quiet') return <QuietBand row={row} scale={scale} />

  return <MonthRow month={row.month} scale={scale} />
}

function QuietBand({
  row,
  scale,
}: {
  row: Extract<TimelineRow, { kind: 'quiet' }>
  scale: (v: number) => number
}) {
  const [open, setOpen] = useState(false)
  const first = row.months[0]
  const last = row.months[row.months.length - 1]

  if (open) {
    return (
      <li>
        <ul className="space-y-1">
          {row.months.map((month) => (
            <MonthRow key={month.month} month={month} scale={scale} />
          ))}
        </ul>
        <button
          onClick={() => setOpen(false)}
          className="w-full py-1.5 text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Collapse these {row.months.length} months
        </button>
      </li>
    )
  }

  const growth = last.closingBalance - first.openingBalance

  return (
    <li>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors hover:bg-accent/60"
      >
        <span className="w-9 shrink-0 text-xs text-muted-foreground">
          {formatMonthShort(first.month)}–{formatMonthShort(last.month)}
        </span>
        <span className="h-px flex-1 border-t border-dashed" />
        <span className="text-xs text-muted-foreground">
          {row.months.length} quiet months · {growth >= 0 ? 'grows' : 'falls'}{' '}
          <span className="tnum">{formatCompactINR(Math.abs(growth))}</span>
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
    </li>
  )
}

function MonthRow({
  month,
  scale,
}: {
  month: ProjectedMonth
  scale: (v: number) => number
}) {
  const router = useRouter()
  const setSelectedMonth = useUi((s) => s.setSelectedMonth)
  const goalOutcomes = useBudget((s) => s.projection?.goalOutcomes ?? [])

  const belowFloor = month.closingBalance < month.floor
  const width = scale(month.closingBalance)
  const floorWidth = scale(month.floor)

  return (
    <li>
      <button
        onClick={() => {
          setSelectedMonth(month.month)
          router.push('/')
        }}
        className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-accent/60"
      >
        <span className="w-9 shrink-0 text-xs font-medium text-muted-foreground">
          {formatMonthShort(month.month)}
        </span>

        <span className="relative h-5 flex-1 overflow-hidden rounded bg-muted/70">
          <span
            className={cn(
              'absolute inset-y-0 left-0 rounded transition-[width]',
              belowFloor ? 'bg-negative/70' : 'bg-chart-1/80',
            )}
            style={{ width: `${width}%` }}
          />
          {/* The floor you promised never to cross. */}
          <span
            className="absolute inset-y-0 w-px bg-foreground/35"
            style={{ left: `${floorWidth}%` }}
            aria-hidden
          />
        </span>

        <span
          className={cn(
            'w-16 shrink-0 text-right num-md',
            belowFloor && 'text-negative',
          )}
        >
          {formatCompactINR(month.closingBalance)}
        </span>
      </button>

      {month.goalsFunded.map((goal) => {
        const outcome = goalOutcomes.find((o) => o.goalId === goal.goalId)
        return <GoalCard key={goal.goalId} name={goal.name} emoji={goal.emoji} cashOut={goal.cashOut} outcome={outcome} />
      })}

      {month.oneOffs.map((oneOff) => (
        <Pin
          key={oneOff.id}
          text={`${oneOff.label} · ${oneOff.direction === 'in' ? '+' : '−'}${formatINR(oneOff.amount)}`}
          tone={oneOff.direction === 'in' ? 'good' : 'plain'}
        />
      ))}

      {month.events.map((event, i) => (
        <Pin
          key={`${event.label}-${i}`}
          // Loan labels already name the thing; don't say it twice.
          text={
            event.label.includes(event.categoryName)
              ? event.label
              : `${event.label} · ${event.categoryName}`
          }
          tone="plain"
        />
      ))}
    </li>
  )
}

function GoalCard({
  name,
  emoji,
  cashOut,
  outcome,
}: {
  name: string
  emoji?: string
  cashOut: number
  outcome?: GoalOutcome
}) {
  const late = outcome?.status === 'late'
  return (
    <div
      className={cn(
        'ml-12 mt-1 rounded-xl border-l-4 bg-card px-3 py-2.5 shadow-sm',
        late ? 'border-l-warn' : 'border-l-positive',
      )}
    >
      <p className="text-sm font-semibold">
        {emoji} {name}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        <span className="tnum">{formatINR(cashOut)}</span>
        {outcome && <> · {describeOutcome(outcome)}</>}
      </p>
    </div>
  )
}

function Pin({ text, tone }: { text: string; tone: 'good' | 'plain' }) {
  return (
    <p
      className={cn(
        'ml-12 mt-1 inline-flex rounded-full px-2.5 py-1 text-xs',
        tone === 'good' ? 'bg-positive-soft text-positive' : 'bg-muted text-muted-foreground',
      )}
    >
      {text}
    </p>
  )
}
