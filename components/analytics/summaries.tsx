'use client'

import { useMemo } from 'react'
import { IconLock } from '@tabler/icons-react'

import { CategoryIcon } from '@/components/category-icon'
import { addMonths, currentMonth, formatMonthLabel, maxMonth } from '@/lib/domain/month'
import { formatCompactINR, formatINR } from '@/lib/domain/money'
import {
  costOverHorizon,
  investmentSummary,
  loanSummary,
  savingsSummary,
} from '@/lib/domain/summary'
import { useBudget } from '@/lib/state/store'
import { catVar } from '@/lib/ui/palette'
import { cn } from '@/lib/utils'
import type { BudgetDoc } from '@/lib/domain/types'

function Card({
  title,
  caption,
  children,
}: {
  title: string
  caption?: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-3 rounded-3xl border bg-card p-4">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {caption && <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="label-xs">{label}</p>
      <p className={cn('num-md mt-1 text-lg font-semibold', tone)}>{value}</p>
    </div>
  )
}

/** What you have put away, what it grew to, and what it is held in. */
export function InvestmentsCard({ doc }: { doc: BudgetDoc }) {
  const projection = useBudget((s) => s.projection)
  const horizonEnd = addMonths(doc.settings.startMonth, doc.settings.horizonMonths - 1)
  const summary = useMemo(
    () => (projection ? investmentSummary(doc, projection, horizonEnd) : null),
    [doc, projection, horizonEnd],
  )

  if (!summary || summary.rows.length === 0) return null

  return (
    <Card
      title="Investments"
      caption={`Projected to ${formatMonthLabel(horizonEnd)}, at the standard rate for each instrument.`}
    >
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Put in" value={formatCompactINR(summary.contributed)} />
        <Stat label="Grown by" value={formatCompactINR(summary.growth)} tone="text-positive" />
        <Stat label="Worth" value={formatCompactINR(summary.value)} />
      </div>

      <ul className="mt-4 space-y-3">
        {summary.rows.map((row) => {
          const share = summary.value > 0 ? row.value / summary.value : 0
          const grown = row.value > 0 ? row.growth / row.value : 0
          return (
            <li key={row.categoryId} className="flex items-center gap-2.5">
              <CategoryIcon name={row.name} icon={row.icon} color={row.color} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-medium">
                  {row.name}
                  {row.locked && <IconLock size={12} className="shrink-0 text-warn" />}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.typeLabel}
                  {row.ratePct > 0 && ` · ${row.ratePct}%`}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  {/* Filled portion is what you put in; the rest is growth. */}
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${share * 100}%`,
                      background: `linear-gradient(90deg, ${catVar(row.color)} ${(1 - grown) * 100}%, color-mix(in oklab, ${catVar(row.color)} 45%, transparent) ${(1 - grown) * 100}%)`,
                    }}
                  />
                </div>
              </div>
              <span className="num-md shrink-0 text-sm">{formatCompactINR(row.value)}</span>
            </li>
          )
        })}
      </ul>

      {summary.locked > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="tnum text-foreground">{formatCompactINR(summary.locked)}</span> of that
          is locked away and cannot fund a goal.
        </p>
      )}
    </Card>
  )
}

/** What the borrowing costs and when it stops. */
export function LoansCard({ doc }: { doc: BudgetDoc }) {
  const now = maxMonth(currentMonth(), doc.settings.startMonth)
  const summary = useMemo(() => loanSummary(doc, now), [doc, now])
  if (summary.rows.length === 0) return null

  return (
    <Card title="Loans" caption="What is still to pay, and the month it ends.">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Every month" value={formatINR(summary.monthlyNow)} />
        <Stat label="Still to pay" value={formatCompactINR(summary.remaining)} />
      </div>

      <ul className="mt-4 space-y-2.5">
        {summary.rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{row.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.monthsLeft > 0
                  ? `${row.monthsLeft} left · ends ${formatMonthLabel(row.endsMonth)}`
                  : 'cleared'}
              </p>
            </div>
            <span className="num-md shrink-0 text-sm">{formatINR(row.emi)}</span>
          </li>
        ))}
      </ul>

      {summary.freeFrom && (
        <p className="mt-4 rounded-2xl bg-positive-soft/60 p-3 text-xs text-positive">
          From {formatMonthLabel(summary.freeFrom)} you have no loan payments at all, and the
          last <span className="tnum font-semibold">{formatINR(summary.freedAmount)}</span> a month
          is yours again.
        </p>
      )}
      {summary.interest === null && (
        <p className="mt-2 text-xs text-muted-foreground">
          Interest is not shown: these were entered as monthly payments, so the principal behind
          them is unknown.
        </p>
      )}
    </Card>
  )
}

/** How much you keep, and how long it would last. */
export function SavingsCard({ doc }: { doc: BudgetDoc }) {
  const projection = useBudget((s) => s.projection)
  const now = maxMonth(currentMonth(), doc.settings.startMonth)
  const summary = useMemo(
    () => (projection ? savingsSummary(projection, now) : null),
    [projection, now],
  )
  if (!summary) return null

  const tone =
    summary.ratePct >= 30 ? 'text-positive' : summary.ratePct >= 10 ? 'text-warn' : 'text-negative'

  return (
    <Card title="What you keep" caption="This month, and how long your money would last.">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Saving rate" value={`${summary.ratePct}%`} tone={tone} />
        <Stat label="Kept" value={formatCompactINR(summary.kept)} />
        <Stat
          label="Runway"
          value={summary.runwayMonths > 120 ? '10y+' : `${summary.runwayMonths} mo`}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {summary.income === 0
          ? 'Add your income in Budget and this becomes meaningful.'
          : `If income stopped today, what you hold covers about ${summary.runwayMonths} months of spending.`}
      </p>
    </Card>
  )
}

/** The number that makes a small monthly habit look like what it really is. */
export function CostCard({ doc }: { doc: BudgetDoc }) {
  const now = maxMonth(currentMonth(), doc.settings.startMonth)
  const months = doc.settings.horizonMonths
  const summary = useMemo(() => costOverHorizon(doc, now, months), [doc, now, months])
  if (summary.rows.length === 0) return null

  const years = Math.round(months / 12)

  return (
    <Card
      title={`Cost over ${years} years`}
      caption="What each spending line adds up to if nothing changes. Investing is counted above, not here."
    >
      <ul className="space-y-2.5">
        {summary.rows.slice(0, 8).map((row) => (
          <li key={row.categoryId} className="flex items-center gap-2.5">
            <CategoryIcon name={row.name} icon={row.icon} color={row.color} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{row.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatINR(row.monthly)} × {row.months} months
              </p>
            </div>
            <span className="num-md shrink-0 text-sm">{formatCompactINR(row.total)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t pt-3 text-sm">
        <span className="text-muted-foreground">Everything, over {years} years: </span>
        <span className="tnum font-semibold">{formatCompactINR(summary.total)}</span>
      </p>
    </Card>
  )
}
