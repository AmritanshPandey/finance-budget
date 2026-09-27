'use client'

import { EditableHeading } from '@/components/editable-heading'
import { useMemo } from 'react'
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react'

import {
  CostCard,
  InvestmentsCard,
  LoansCard,
  SavingsCard,
} from '@/components/analytics/summaries'
import { EChart } from '@/components/charts/echart'
import { YearlyView } from '@/components/analytics/yearly-view'
import type { EChartsOption } from 'echarts'
import type { TrendPoint } from '@/components/charts/area-trend'
import type { DonutSlice } from '@/components/charts/donut'
import { monthActuals } from '@/lib/domain/actuals'
import {
  addMonths,
  compareMonth,
  currentMonth,
  formatMonthShort,
  maxMonth,
} from '@/lib/domain/month'
import { formatCompactINR, formatINR } from '@/lib/domain/money'
import { colourOf, useResolvedPalette } from '@/lib/ui/resolved-palette'
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
  // A plan may start in the future; reading today's month would show all zeroes.
  const now = doc ? maxMonth(currentMonth(), doc.settings.startMonth) : currentMonth()
  const palette = useResolvedPalette()

  /**
   * A window around today: up to a year of history where it exists, and two
   * years of the plan ahead. This app is mostly about what is coming, so a
   * chart that only looks backwards is empty on a plan that starts today.
   */
  const months = useMemo(() => {
    if (!doc) return []
    const start = doc.settings.startMonth
    const last = addMonths(start, doc.settings.horizonMonths - 1)
    let first = addMonths(now, -11)
    if (compareMonth(first, start) < 0) first = start
    const out: string[] = []
    for (let m = first; compareMonth(m, last) <= 0; m = addMonths(m, 1)) {
      out.push(m)
      if (compareMonth(m, addMonths(now, 23)) >= 0) break
    }
    return out
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
    // Nothing existed before the plan began, so a delta against it is noise.
    const comparable = compareMonth(previous, doc.settings.startMonth) >= 0
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
          delta: comparable ? value - before : null,
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
        color: colourOf(palette, c.color),
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [doc, now, palette])

  if (!doc) return null

  const nowIndex = months.indexOf(now)

  const trendOption: EChartsOption = {
    animationDuration: 500,
    grid: { left: 0, right: 0, top: 8, bottom: 18, containLabel: false },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(20,20,20,0.95)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      valueFormatter: (value) => formatINR(Number(value)),
    },
    xAxis: {
      type: 'category',
      data: points.map((p) => p.label),
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: 'rgba(0,0,0,0.55)', fontSize: 10, interval: 'auto' },
    },
    yAxis: { type: 'value', show: false, min: 'dataMin' },
    series: [
      {
        type: 'line',
        smooth: 0.4,
        showSymbol: false,
        data: points.map((p) => p.value),
        lineStyle: { width: 2.5, color: 'rgba(0,0,0,0.75)' },
        areaStyle: { color: 'rgba(0,0,0,0.16)' },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: 'rgba(0,0,0,0.45)', type: 'dashed', width: 1 },
          data: [{ xAxis: nowIndex }],
        },
      },
    ],
  }

  const donutOption: EChartsOption = {
    animationDuration: 500,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(20,20,20,0.95)',
      borderWidth: 0,
      textStyle: { color: palette.text, fontSize: 12 },
      valueFormatter: (value) => formatINR(Number(value)),
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '88%'],
        avoidLabelOverlap: true,
        padAngle: 1.5,
        itemStyle: { borderRadius: 4, borderWidth: 0 },
        label: { show: false },
        emphasis: { scale: true, scaleSize: 4 },
        data: slices.map((slice) => ({
          name: slice.label,
          value: slice.value,
          itemStyle: { color: slice.color },
        })),
      },
    ],
  }

  const thisMonth = points[nowIndex]?.value ?? points[0]?.value ?? 0
  // Against a year out, which is the comparison a forward plan can actually make.
  const aheadIndex = Math.min(nowIndex + 12, points.length - 1)
  const ahead = points[aheadIndex]?.value ?? thisMonth
  const changePct = thisMonth > 0 ? ((ahead - thisMonth) / thisMonth) * 100 : 0
  const down = changePct < 0
  const total = slices.reduce((a, s) => a + s.value, 0)

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-safe">
      <header className="pb-4 pt-5">
        <EditableHeading as="h1" labelKey="analytics.title" className="text-xl font-semibold tracking-tight" />
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
          <EditableHeading labelKey="analytics.spending" className="text-base font-semibold" />
          {points.length > 1 && aheadIndex !== nowIndex && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-xs font-semibold text-foreground">
              {down ? (
                <IconTrendingDown size={13} stroke={2.4} className="text-positive" />
              ) : (
                <IconTrendingUp size={13} stroke={2.4} className="text-negative" />
              )}
              {down ? 'Down' : 'Up'} {Math.abs(Math.round(changePct))}% by{' '}
              {points[aheadIndex]?.label}
            </span>
          )}
        </div>

        <p className="num-xl mt-2">{formatINR(thisMonth)}</p>

        <div className="-mx-2 mt-2">
          <EChart option={trendOption} height={150} />
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
                {group.delta === null || group.delta === 0
                  ? '—'
                  : `${group.delta > 0 ? '+' : '−'}${formatCompactINR(Math.abs(group.delta))}`}
              </span>
            </div>
          </article>
        ))}
      </div>

      <section className="mt-3 rounded-3xl border bg-card p-4">
        <EditableHeading labelKey="analytics.allocation" className="text-sm font-semibold tracking-tight" />
        {slices.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="w-full max-w-56 shrink-0">
              <EChart option={donutOption} height={200} />
            </div>

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

      <YearlyView doc={doc} />

      <InvestmentsCard doc={doc} />
      <LoansCard doc={doc} />
      <SavingsCard doc={doc} />
      <CostCard doc={doc} />

      <p className="mt-4 px-1 text-xs leading-relaxed text-muted-foreground">
        Growth and inflation figures come from long-run averages, and are assumptions rather than
        forecasts. Change any of them per line in Setup.
      </p>
    </div>
  )
}
