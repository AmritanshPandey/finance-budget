'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { RupeeField } from '@/components/rupee-field'
import { Section } from '@/components/setup/section'
import { Button } from '@/components/ui/button'
import { currentMonth, formatMonthLabel, maxMonth } from '@/lib/domain/month'
import { formatINR } from '@/lib/domain/money'
import { recordBalanceCheck } from '@/lib/domain/mutations'
import { useBudget } from '@/lib/state/store'
import type { BudgetDoc } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

/**
 * The one reality anchor. A plan-only forecast is a tower of intentions until
 * you occasionally tell it what is actually in your account.
 */
export function BalanceCheckSection({ doc }: { doc: BudgetDoc }) {
  const apply = useBudget((s) => s.apply)
  const projection = useBudget((s) => s.projection)
  const [actual, setActual] = useState<number>(0)

  // A plan may start in the future; quoting a month before it began is noise.
  const now = maxMonth(currentMonth(), doc.settings.startMonth)
  const projected =
    projection?.months.find((m) => m.month === now)?.closingBalance ??
    projection?.months[0]?.closingBalance ??
    0

  const drift = actual - projected
  const entered = actual > 0
  const last = doc.balanceChecks[doc.balanceChecks.length - 1]

  function record(rebaselined: boolean) {
    apply((d) =>
      recordBalanceCheck(d, {
        date: new Date().toISOString().slice(0, 10),
        actualBalance: actual,
        rebaselined,
      }),
    )
    setActual(0)
    toast(
      rebaselined
        ? 'Forecast restarted from today’s balance'
        : 'Balance noted — the forecast is unchanged',
    )
  }

  return (
    <Section
      title="Balance check"
      caption="Whenever you feel like it. One number keeps the forecast honest."
    >
      <p className="text-sm text-muted-foreground">
        The plan says you should have{' '}
        <span className="tnum font-medium text-foreground">{formatINR(projected)}</span> by the
        end of {formatMonthLabel(now)}.
      </p>

      <div className="mt-5">
        <RupeeField
          label="What's actually there"
          value={actual}
          onChange={setActual}
          placeholder="0"
        />
      </div>

      {entered && (
        <div className="mt-4 rounded-xl border bg-background p-4">
          <p className="text-sm">
            {Math.abs(drift) < 100 ? (
              <>Bang on plan.</>
            ) : (
              <>
                You&rsquo;re{' '}
                <span className={cn('tnum font-semibold', drift < 0 ? 'text-negative' : 'text-positive')}>
                  {formatINR(Math.abs(drift))}
                </span>{' '}
                {drift < 0 ? 'behind' : 'ahead of'} plan.
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => record(true)}>
              Start the forecast from here
            </Button>
            <Button size="sm" variant="ghost" onClick={() => record(false)}>
              Just note it
            </Button>
          </div>
        </div>
      )}

      {last && (
        <p className="mt-4 text-xs text-muted-foreground">
          Last checked {last.date} · {formatINR(last.actualBalance)}
          {last.rebaselined && ' · forecast restarted from there'}
        </p>
      )}
    </Section>
  )
}
