'use client'

import { useMemo, useState } from 'react'
import { IconChevronRight } from '@tabler/icons-react'
import type { EChartsOption } from 'echarts'

import { CategoryIcon } from '@/components/category-icon'
import { EditableHeading } from '@/components/editable-heading'
import { EChart } from '@/components/charts/echart'
import { CATEGORY_COLORS } from '@/lib/domain/look'
import { formatCompactINR, formatINR } from '@/lib/domain/money'
import { growthPct, monthsCovered, yearlySummary, type YearRow } from '@/lib/domain/yearly'
import { colourOf, useResolvedPalette } from '@/lib/ui/resolved-palette'
import { cn } from '@/lib/utils'
import type { BudgetDoc, Paise } from '@/lib/domain/types'

/** A change against another year, as a quiet figure rather than a badge. */
function Change({ previous, next }: { previous: Paise; next: Paise }) {
  const pct = growthPct(previous, next)
  if (pct === null) return <span className="text-sm text-muted-foreground">—</span>

  const up = pct > 0
  const flat = Math.abs(pct) < 0.5

  return (
    <span
      className={cn(
        'whitespace-nowrap text-sm tnum',
        flat ? 'text-muted-foreground' : up ? 'text-negative' : 'text-positive',
      )}
    >
      {pct === Infinity ? 'new' : `${up ? '↑' : '↓'} ${Math.abs(Math.round(pct))}%`}
    </span>
  )
}

/**
 * The plan, as one picture.
 *
 * The chart is the page and the list beneath it is the chart's legend — the
 * same colours, in the same order, so there is nothing to cross-reference.
 */
export function YearlyView({ doc }: { doc: BudgetDoc }) {
  const palette = useResolvedPalette()
  const summary = useMemo(() => yearlySummary(doc), [doc])
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const labels = summary.years.map((year) =>
    monthsCovered(doc, year) === 12 ? String(year) : `${year}*`,
  )

  const fullYears = summary.years
    .map((year, index) => ({ year, index }))
    .filter(({ year }) => monthsCovered(doc, year) === 12)
  const fromIndex = fullYears[0]?.index ?? 0
  const toIndex = fullYears[fullYears.length - 1]?.index ?? summary.years.length - 1

  /** Two groups must never share a colour, or the stack stops being readable. */
  const groupColour = useMemo(() => {
    const map = new Map<string, string>()
    const taken = new Set<string>()
    for (const group of summary.groups) {
      const members = summary.rows
        .filter((r) => r.groupId === group.id)
        .sort((a, b) => b.total - a.total)
      const candidates = [...members.map((m) => m.color), ...CATEGORY_COLORS].filter(
        (c): c is string => Boolean(c),
      )
      const pick = candidates.find((c) => !taken.has(c)) ?? candidates[0] ?? 'slate'
      taken.add(pick)
      map.set(group.id, colourOf(palette, pick))
    }
    return map
  }, [summary, palette])

  const option: EChartsOption = useMemo(
    () => ({
      animationDuration: 600,
      grid: { left: 2, right: 2, top: 10, bottom: 22, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: palette.muted, opacity: 0.35 } },
        backgroundColor: '#ffffff',
        borderColor: 'rgba(0,0,0,0.08)',
        borderWidth: 1,
        padding: [8, 10],
        textStyle: { color: palette.text, fontSize: 12 },
        valueFormatter: (value) => formatCompactINR(Number(value)),
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: palette.muted, fontSize: 11, interval: 1 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: palette.muted, opacity: 0.14 } },
        axisLabel: {
          color: palette.muted,
          fontSize: 11,
          formatter: (value: number) => formatCompactINR(value),
        },
      },
      series: summary.groups.map((group) => ({
        name: group.name,
        type: 'line' as const,
        stack: 'plan',
        smooth: 0.3,
        showSymbol: false,
        lineStyle: { width: 0 },
        emphasis: { focus: 'series' as const },
        areaStyle: { color: groupColour.get(group.id), opacity: 0.88 },
        data: group.byYear,
      })),
    }),
    [summary, labels, palette, groupColour],
  )

  const planTotal = summary.totals.reduce((a, b) => a + b, 0)

  return (
    <section>
      <EditableHeading
        as="h1"
        labelKey="analytics.title"
        className="title-serif text-[2rem] leading-tight"
      />
      <p className="num-hero mt-2">{formatCompactINR(planTotal)}</p>
      <p className="mt-1 text-[0.9375rem] text-muted-foreground">
        planned across {summary.years.length} years, {summary.years[0]} to{' '}
        {summary.years[summary.years.length - 1]}
      </p>

      {/* Full bleed. The chart is the page, not an illustration inside a card. */}
      <div className="-mx-4 mt-5">
        <EChart option={option} height={280} />
      </div>

      <ul className="mt-5">
        {summary.groups.map((group) => {
          const expanded = open[group.id]
          const rows = summary.rows.filter((r) => r.groupId === group.id)

          return (
            <li key={group.id} className="border-b border-border/70 last:border-0">
              <button
                onClick={() => setOpen((o) => ({ ...o, [group.id]: !o[group.id] }))}
                className="flex w-full items-center gap-3 py-3.5 text-left"
              >
                <span
                  className="size-3 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: groupColour.get(group.id) }}
                />
                <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{group.name}</span>
                <span className="num-md shrink-0">{formatCompactINR(group.total)}</span>
                <span className="w-16 shrink-0 text-right">
                  <Change previous={group.byYear[fromIndex]} next={group.byYear[toIndex]} />
                </span>
                <IconChevronRight
                  size={15}
                  className={cn(
                    'shrink-0 text-muted-foreground/60 transition-transform',
                    expanded && 'rotate-90',
                  )}
                />
              </button>

              {expanded && (
                <ul className="mb-3 space-y-0.5 pl-6">
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

      <p className="mt-4 text-sm text-muted-foreground">
        Change compares {summary.years[fromIndex]} with {summary.years[toIndex]}. A year marked
        with a star is only partly covered by the plan.
      </p>
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
        className="flex w-full items-center gap-2.5 py-2 text-left"
      >
        <CategoryIcon name={row.name} icon={row.icon} color={row.color} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
        <span className="num-md shrink-0 text-sm">{formatCompactINR(row.total)}</span>
        <span className="w-16 shrink-0 text-right">
          <Change previous={row.byYear[fromIndex]} next={row.byYear[toIndex]} />
        </span>
      </button>

      {open && (
        <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {row.byYear.map((amount, index) => (
            <div
              key={index}
              className={cn(
                'shrink-0 rounded-lg px-2.5 py-2 text-center',
                amount === 0 ? 'bg-elevated/60' : 'bg-elevated',
              )}
            >
              <p className="text-xs text-muted-foreground">{labels[index]}</p>
              <p className={cn('mt-0.5 text-sm tnum', amount === 0 && 'text-muted-foreground/50')}>
                {amount === 0 ? '—' : formatINR(amount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </li>
  )
}
