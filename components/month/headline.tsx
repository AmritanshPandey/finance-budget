'use client'

import { formatINR } from '@/lib/domain/money'
import type { Paise } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

/**
 * The one number that matters, and nothing competing with it.
 */
export function Headline({
  surplus,
  target,
  income,
  expenses,
  frozen,
}: {
  surplus: Paise
  target: Paise
  income: Paise
  expenses: Paise
  frozen: boolean
}) {
  const negative = surplus < 0
  const onTarget = target > 0 && surplus >= target
  const tone = negative ? 'negative' : onTarget || target === 0 ? 'positive' : 'warn'
  const progress = target > 0 ? Math.max(0, Math.min(1, surplus / target)) : surplus > 0 ? 1 : 0

  return (
    <section className="pt-1">
      <p className="label-xs">{negative ? 'Short this month' : 'Left to save this month'}</p>
      <p
        className={cn(
          'num-xl mt-1.5',
          tone === 'negative' && 'text-negative',
          tone === 'warn' && 'text-foreground',
          tone === 'positive' && 'text-foreground',
        )}
      >
        {formatINR(surplus)}
      </p>

      {target > 0 && (
        <div className="mt-3 max-w-xs">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-300',
                tone === 'negative' && 'bg-negative',
                tone === 'warn' && 'bg-warn',
                tone === 'positive' && 'bg-positive',
              )}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {onTarget ? 'At your target of ' : 'Target '}
            <span className="tnum text-foreground">{formatINR(target)}</span>
            {!onTarget && !negative && (
              <> · {formatINR(target - surplus)} short</>
            )}
          </p>
        </div>
      )}

      <p className="mt-3 text-sm text-muted-foreground">
        <span className="tnum">{formatINR(income)}</span> in ·{' '}
        <span className="tnum">{formatINR(expenses)}</span> out
        {frozen && <span className="ml-2 text-muted-foreground/70">· closed</span>}
      </p>
    </section>
  )
}
