'use client'

import { useMemo } from 'react'
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react'

import { AreaTrend, type TrendPoint } from '@/components/charts/area-trend'
import { Donut, type DonutSlice } from '@/components/charts/donut'
import { monthActuals } from '@/lib/domain/actuals'
import {
  addMonths,
  compareMonth,
  currentMonth,
  formatMonthShort,
  monthsBetween,
} from '@/lib/domain/month'
import { formatCompactINR, formatINR } from '@/lib/domain/money'
import { catVar } from '@/lib/ui/palette'
import { resolveMonth } from '@/lib/domain/resolve-month'
import { useBudget } from '@/lib/state/store'
import { cn } from '@/lib/utils'
import type { BudgetDoc, ISOMonth, Paise } from '@/lib/domain/types'

/** Spend for a month: what really happened if it is over, else the plan. */
function spendFor(doc: BudgetDoc, month: ISOMonth, now: ISOMonth): Paise {
  if (compareMonth(month, now) < 0) {
    const actual = monthActuals(doc, month)
    if (actual.count > 0) return actual.spent
  }
  if (month === now) {
    const actual = monthActuals(doc, month)
    if (actual.count > 0) return actual.spent
  }
  const view = resolveMonth(doc, month)
  return view.expenses + view.emis
}

export function AnalyticsScreen() {
  const doc = useBudget((s) => s.doc)
  const now = currentMonth()

  const months = useMemo(() => {
    if (!doc) return []
    const start = doc.settings.startMonth
    const span = Math.min(12, monthsBetween(start, now) + 1)
    return Array.from({ length: Math.max(1, span) }, (_, i) => addMonths(now, i - span + 1))
  }, [doc, now])

  const points: TrendPoint[] = useMemo(
    () =>
      doc
        ? months.map((m) => ({ label: formatMonthShort(m), value: spendFor(doc, m, now) }))
        : [],
    [doc, months, now],
  )

  const groups = useMemo(() => {
    if (!doc) return []
    const view = resolveMonth(doc, now)
    const previous = addMonths(now, -1)
    const actualNow = monthActuals(doc, now)
    const actualPrev = monthActuals(doc, previous)
    const prevView = resolveMonth(doc, previous)

    return [...doc.groups]
      .sort((a, b) => a.order - b.order)
      .map((group) => {
        const members = doc.categories.filter(
          (c) => c.groupId === group.id && c.kind !== 'income' && !c.archivedAt,
        )
        if (members.length === 0) return null

        const sumOf = (byCategory: Map<string, Paise>) =>
          members.reduce((a, c) => a + (byCategory.get(c.id) ?? 0), 0)

        const plannedNow = members.reduce(
          (a, c) => a + (view.lines.find((l) => l.categoryId === c.id)?.amount ?? 0),
          0,
        )
        const plannedPrev = members.reduce(
          (a, c) => a + (prevView.lines.find((l) => l.categoryId === c.id)?.amount ?? 0),
          0,
        )

        const value = actualNow.count > 0 ? sumOf(actualNow.byCategory) : plannedNow
        const before = actualPrev.count > 0 ? sumOf(actualPrev.byCategory) : plannedPrev

        const biggest = [...members].sort(
          (a, b) =>
            (view.lines.find((l) => l.categoryId === b.id)?.amount ?? 0) -
            (view.lines.find((l) => l.categoryId === a.id)?.amount ?? 0),
        )[0]

        return {
          id: group.id,
          name: group.name,
          value,
          delta: value - before,
          planned: plannedNow,
          // The group takes its colour from the line it spends most on.
          color: biggest?.color ?? 'slate',
        }
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)
  }, [doc, now])

  const slices: DonutSlice[] = useMemo(() => {
    if (!doc) return []
    const view = resolveMonth(doc, now)
    const actual = monthActuals(doc, now)
    return doc.categories
      .filter((c) => c.kind !== 'income' && !c.archivedAt)
      .map((c) => ({
        label: c.name,
        value:
          actual.count > 0
            ? (actual.byCategory.get(c.id) ?? 0)
            : (view.lines.find((l) => l.categoryId === c.id)?.amount ?? 0),
        color: catVar(c.color),
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [doc, now])

  if (!doc) return null

  const thisMonth = points[points.length - 1]?.value ?? 0
  const lastMonth = points[points.length - 2]?.value ?? 0
  const changePct = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0
  const down = changePct < 0
  const total = slices.reduce((a, s) => a + s.value, 0)

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-safe">
      <header className="pb-4 pt-5">
        <h1 className="text-xl font-semibold tracking-tight">Trends</h1>
        <p className="text-xs text-muted-foreground">
          Where the money went, and where it is going.
        </p>
      </header>

      <section
        className="overflow-hidden rounded-3xl p-5"
        style={{
          background:
            'linear-gradient(155deg, var(--cat-purple) 0%, color-mix(in oklab, var(--cat-purple) 78%, var(--cat-blue)) 100%)',
          color: 'var(--on-cat)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">Overall spending</h2>
          {lastMonth > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-xs font-semibold text-foreground">
              {down ? (
                <IconTrendingDown size={13} stroke={2.4} className="text-positive" />
              ) : (
                <IconTrendingUp size={13} stroke={2.4} className="text-negative" />
              )}
              {down ? 'Down' : 'Up'} {Math.abs(Math.round(changePct))}% vs{' '}
              {points[points.length - 2]?.label}
            </span>
          )}
        </div>

        <p className="num-xl mt-2">{formatINR(thisMonth)}</p>

        <div className="mt-3 opacity-90">
          <AreaTrend points={points} markerIndex={points.length - 1} />
        </div>

        <div className="mt-1 flex justify-between text-xs font-medium opacity-70">
          <span>{points[0]?.label}</span>
          <span>{points[Math.floor(points.length / 2)]?.label}</span>
          <span>{points[points.length - 1]?.label}</span>
        </div>
      </section>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {groups.map((group) => (
          <article
            key={group.id}
            className="rounded-3xl p-4"
            style={{ backgroundColor: catVar(group.color), color: 'var(--on-cat)' }}
          >
            <h3 className="text-sm font-semibold">{group.name}</h3>
            <p className="num-md mt-2 text-lg font-semibold">{formatCompactINR(group.value)}</p>
            <p className="text-xs font-medium opacity-70">
              of {formatCompactINR(group.planned)} planned
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/15">
                <div
                  className="h-full rounded-full bg-black/55"
                  style={{
                    width: `${group.planned > 0 ? Math.min(100, (group.value / group.planned) * 100) : 0}%`,
                  }}
                />
              </div>
              <span className="shrink-0 text-xs font-semibold tnum">
                {group.delta === 0
                  ? '—'
                  : `${group.delta > 0 ? '+' : '−'}${formatCompactINR(Math.abs(group.delta))}`}
              </span>
            </div>
          </article>
        ))}
      </div>

      <section className="mt-3 rounded-3xl border bg-card p-4">
        <h2 className="text-sm font-semibold tracking-tight">Where it goes</h2>
        {slices.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <Donut slices={slices}>
              <span className="label-xs">Total</span>
              <span className="num-md mt-0.5">{formatCompactINR(total)}</span>
            </Donut>

            <ul className="w-full flex-1 space-y-1.5">
              {slices.slice(0, 7).map((slice) => (
                <li key={slice.label} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {slice.label}
                  </span>
                  <span className="num-md shrink-0 text-sm">{formatCompactINR(slice.value)}</span>
                  <span className={cn('w-9 shrink-0 text-right text-xs text-muted-foreground tnum')}>
                    {Math.round((slice.value / total) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
