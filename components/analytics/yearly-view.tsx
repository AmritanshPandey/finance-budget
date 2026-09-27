'use client'

import { useMemo, useState } from 'react'
import { IconChevronRight, IconMinus, IconTrendingDown, IconTrendingUp } from '@tabler/icons-react'
import type { EChartsOption } from 'echarts'

import { CategoryIcon } from '@/components/category-icon'
import { EChart } from '@/components/charts/echart'
import { formatCompactINR, formatINR } from '@/lib/domain/money'
import { growthPct, monthsCovered, yearlySummary, type YearRow } from '@/lib/domain/yearly'
import { CATEGORY_COLORS } from '@/lib/domain/look'
import { colourOf, useResolvedPalette } from '@/lib/ui/resolved-palette'
import { cn } from '@/lib/utils'
import type { BudgetDoc, Paise } from '@/lib/domain/types'

/** A year's change against the one before it, as a chip. */
function Change({ previous, next }: { previous: Paise; next: Paise }) {
  const pct = growthPct(previous, next)
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>

  const up = pct > 0
  const flat = Math.abs(pct) < 0.5
  const Icon = flat ? IconMinus : up ? IconTrendingUp : IconTrendingDown

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium tnum',
        flat ? 'text-muted-foreground' : up ? 'text-negative' : 'text-positive',
      )}
    >
      <Icon size={12} stroke={2.4} />
      {pct === Infinity ? 'new' : `${up ? '+' : ''}${Math.round(pct)}%`}
    </span>
  )
}

export function YearlyView({ doc }: { doc: BudgetDoc }) {
  const palette = useResolvedPalette()
  const summary = useMemo(() => yearlySummary(doc), [doc])
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [focus, setFocus] = useState<string | null>(null)

  const labels = summary.years.map((year) => {
    const months = monthsCovered(doc, year)
    return months === 12 ? String(year) : `${year}*`
  })

  /**
   * Comparing the last two years says nothing when a plan ends on a plateau,
   * and a part-covered first year exaggerates everything. The honest span is
   * first full year to last full year.
   */
  const fullYears = summary.years
    .map((year, index) => ({ year, index }))
    .filter(({ year }) => monthsCovered(doc, year) === 12)
  const fromIndex = fullYears[0]?.index ?? 0
  const toIndex = fullYears[fullYears.length - 1]?.index ?? summary.years.length - 1
  const spanLabel =
    fullYears.length > 1 ? `${summary.years[fromIndex]} → ${summary.years[toIndex]}` : 'over the plan'

  /**
   * A group takes the colour of whatever it spends most on, so the chart reads
   * like the list beneath it — but two groups must never share a colour, or the
   * stack becomes unreadable. Where the first choice is taken, the next
   * distinct colour inside the group wins, then anything still unused.
   */
  const groupColour = useMemo(() => {
    const map = new Map<string, string>()
    const taken = new Set<string>()

    for (const group of summary.groups) {
      const members = summary.rows
        .filter((r) => r.groupId === group.id)
        .sort((a, b) => b.total - a.total)

      const candidates = [
        ...members.map((m) => m.color),
        ...CATEGORY_COLORS,
      ].filter((c): c is string => Boolean(c))

      const pick = candidates.find((c) => !taken.has(c)) ?? candidates[0] ?? 'slate'
      taken.add(pick)
      map.set(group.id, colourOf(palette, pick))
    }
    return map
  }, [summary, palette])

  const stacked: EChartsOption = useMemo(
    () => ({
      animationDuration: 500,
      grid: { left: 8, right: 8, top: 12, bottom: 24, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: palette.muted, opacity: 0.4 } },
        backgroundColor: 'rgba(20,20,20,0.95)',
        borderWidth: 0,
        textStyle: { color: palette.text, fontSize: 12 },
        valueFormatter: (value) => formatCompactINR(Number(value)),
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: palette.muted, opacity: 0.25 } },
        axisTick: { show: false },
        axisLabel: { color: palette.muted, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: palette.muted, opacity: 0.12 } },
        axisLabel: {
          color: palette.muted,
          fontSize: 11,
          formatter: (value: number) => formatCompactINR(value),
        },
      },
      series: summary.groups.map((group) => ({
        name: group.name,
        type: 'line' as const,
        stack: 'total',
        smooth: 0.35,
        showSymbol: false,
        lineStyle: { width: 0 },
        emphasis: { focus: 'series' as const },
        areaStyle: {
          color: groupColour.get(group.id),
          opacity: focus && focus !== group.id ? 0.18 : 0.85,
        },
        data: group.byYear,
      })),
    }),
    [summary, labels, palette, groupColour, focus],
  )

  const planTotal = summary.totals.reduce((a, b) => a + b, 0)

  return (
    <section className="mt-3 rounded-3xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Year by year</h2>
        <span className="text-xs text-muted-foreground">
          {formatCompactINR(planTotal)} over {summary.years.length} years
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Change shown is {spanLabel}. Open a group for its lines, and a line for every year.
      </p>

      <div className="-mx-1 mt-3">
        <EChart option={stacked} height={230} />
      </div>

      {/* The change from one year to the next, which is the thing worth seeing. */}
      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {summary.years.map((year, index) => (
          <div key={year} className="shrink-0 rounded-xl bg-muted/50 px-3 py-2">
            <p className="text-[0.6875rem] font-medium text-muted-foreground">{labels[index]}</p>
            <p className="num-md mt-0.5 text-sm">{formatCompactINR(summary.totals[index])}</p>
            {index > 0 && (
              <Change previous={summary.totals[index - 1]} next={summary.totals[index]} />
            )}
          </div>
        ))}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        A year marked * is only partly covered by the plan.
      </p>

      {/* Groups summarised, expanding to the lines inside them. */}
      <ul className="mt-4 space-y-1">
        {summary.groups.map((group) => {
          const open = openGroups[group.id]
          const rows = summary.rows.filter((r) => r.groupId === group.id)
          return (
            <li key={group.id}>
              <button
                onClick={() => setOpenGroups((g) => ({ ...g, [group.id]: !g[group.id] }))}
                onPointerEnter={() => setFocus(group.id)}
                onPointerLeave={() => setFocus(null)}
                className="flex w-full items-center gap-2.5 rounded-xl px-1 py-2.5 text-left transition-colors hover:bg-accent/60"
              >
                <IconChevronRight
                  size={14}
                  className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
                />
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: groupColour.get(group.id) }}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{group.name}</span>
                <span className="num-md shrink-0 text-sm">{formatCompactINR(group.total)}</span>
                <span className="w-14 shrink-0 text-right">
                  <Change previous={group.byYear[fromIndex]} next={group.byYear[toIndex]} />
                </span>
              </button>

              {open && (
                <ul className="mb-2 ml-6 space-y-0.5 border-l pl-3">
                  {rows.map((row) => (
                    <LineYears
                      key={row.categoryId}
                      row={row}
                      labels={labels}
                      fromIndex={fromIndex}
                      toIndex={toIndex}
                    />
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** One line's whole life, year by year. */
function LineYears({
  row,
  labels,
  fromIndex,
  toIndex,
}: {
  row: YearRow
  labels: string[]
  fromIndex: number
  toIndex: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <li>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left transition-colors hover:bg-accent/60"
      >
        <CategoryIcon name={row.name} icon={row.icon} color={row.color} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
        <span className="num-md shrink-0 text-sm">{formatCompactINR(row.total)}</span>
        <span className="w-14 shrink-0 text-right">
          <Change previous={row.byYear[fromIndex]} next={row.byYear[toIndex]} />
        </span>
      </button>

      {open && (
        <div className="-mx-1 mb-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {row.byYear.map((amount, index) => (
            <div
              key={index}
              className={cn(
                'shrink-0 rounded-lg px-2 py-1.5 text-center',
                amount === 0 ? 'bg-muted/30' : 'bg-muted/70',
              )}
            >
              <p className="text-[0.625rem] text-muted-foreground">{labels[index]}</p>
              <p className={cn('text-xs tnum', amount === 0 && 'text-muted-foreground/50')}>
                {amount === 0 ? '—' : formatINR(amount)}
              </p>
              {index > 0 && (
                <Change previous={row.byYear[index - 1]} next={amount} />
              )}
            </div>
          ))}
        </div>
      )}
    </li>
  )
}
