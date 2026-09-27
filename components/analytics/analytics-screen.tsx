'use client'

import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'

import {
  CostCard,
  InvestmentsCard,
  LoansCard,
  SavingsCard,
} from '@/components/analytics/summaries'
import { YearlyView } from '@/components/analytics/yearly-view'
import { EChart } from '@/components/charts/echart'
import { monthActuals } from '@/lib/domain/actuals'
import {
  addMonths,
  compareMonth,
  currentMonth,
  formatMonthShort,
  maxMonth,
} from '@/lib/domain/month'
import { formatCompactINR, formatINR } from '@/lib/domain/money'
import { resolveMonth } from '@/lib/domain/resolve-month'
import { useBudget } from '@/lib/state/store'
import { useResolvedPalette } from '@/lib/ui/resolved-palette'
import type { BudgetDoc, ISOMonth, Paise } from '@/lib/domain/types'

/** Spend for a month: what really happened if it is over, else the plan. */
function spendFor(doc: BudgetDoc, month: ISOMonth): Paise {
  const actual = monthActuals(doc, month)
  if (actual.count > 0) return actual.spent
  const view = resolveMonth(doc, month)
  return view.expenses + view.emis
}

export function AnalyticsScreen() {
  const doc = useBudget((s) => s.doc)
  const palette = useResolvedPalette()
  // A plan may start in the future; reading today's month would show all zeroes.
  const now = doc ? maxMonth(currentMonth(), doc.settings.startMonth) : currentMonth()

  /** A year behind where it exists, two ahead — this app is mostly about ahead. */
  const months = useMemo(() => {
    if (!doc) return []
    const start = doc.settings.startMonth
    const last = addMonths(start, doc.settings.horizonMonths - 1)
    let first = addMonths(now, -11)
    if (compareMonth(first, start) < 0) first = start
    const out: ISOMonth[] = []
    for (let m = first; compareMonth(m, last) <= 0; m = addMonths(m, 1)) {
      out.push(m)
      if (compareMonth(m, addMonths(now, 23)) >= 0) break
    }
    return out
  }, [doc, now])

  const values = useMemo(
    () => (doc ? months.map((m) => spendFor(doc, m)) : []),
    [doc, months],
  )
  const nowIndex = months.indexOf(now)

  const aheadOption: EChartsOption = useMemo(
    () => ({
      animationDuration: 600,
      grid: { left: 2, right: 2, top: 10, bottom: 20, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: 'rgba(0,0,0,0.08)',
        borderWidth: 1,
        padding: [8, 10],
        textStyle: { color: palette.text, fontSize: 12 },
        valueFormatter: (value) => formatINR(Number(value)),
      },
      xAxis: {
        type: 'category',
        data: months.map((m) => formatMonthShort(m)),
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: palette.muted, fontSize: 11, interval: 3 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: palette.muted, opacity: 0.14 } },
        axisLabel: {
          color: palette.muted,
          fontSize: 11,
          formatter: (v: number) => formatCompactINR(v),
        },
      },
      series: [
        {
          type: 'line',
          smooth: 0.35,
          showSymbol: false,
          data: values,
          lineStyle: { width: 2, color: palette.blue },
          areaStyle: { color: palette.blue, opacity: 0.12 },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: true, formatter: 'now', position: 'start', color: palette.muted, fontSize: 11 },
            lineStyle: { color: palette.muted, type: 'dashed', width: 1 },
            data: [{ xAxis: nowIndex }],
          },
        },
      ],
    }),
    [months, values, palette, nowIndex],
  )

  if (!doc) return null

  const thisMonth = values[nowIndex] ?? values[0] ?? 0
  const aheadIndex = Math.min(nowIndex + 12, values.length - 1)
  const ahead = values[aheadIndex] ?? thisMonth

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-safe">
      <div className="pt-8">
        <YearlyView doc={doc} />
      </div>

      <section className="mt-10 border-t pt-6">
        <h2 className="title-serif text-[1.375rem]">The next two years</h2>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">
          {formatINR(thisMonth)} a month now,{' '}
          {ahead === thisMonth ? 'unchanged' : `${formatINR(ahead)} by this time next year`}.
        </p>
        <div className="-mx-4 mt-4">
          <EChart option={aheadOption} height={190} />
        </div>
      </section>

      <InvestmentsCard doc={doc} />
      <LoansCard doc={doc} />
      <SavingsCard doc={doc} />
      <CostCard doc={doc} />

      <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
        Growth and inflation figures are long-run averages, so treat them as assumptions rather
        than forecasts. Any of them can be changed per line in Setup.
      </p>
    </div>
  )
}
