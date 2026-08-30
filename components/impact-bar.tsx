'use client'

import Link from 'next/link'
import { IconArrowRight, IconSparkles } from '@tabler/icons-react'

import { summariseOutcomes } from '@/lib/domain/goals'
import { useBudget } from '@/lib/state/store'
import { cn } from '@/lib/utils'

/**
 * Always present, always true. Editing any number anywhere changes this line —
 * consequence is visible while you type, with no mode to enter.
 */
export function ImpactBar() {
  const impact = useBudget((s) => s.impact)
  const projection = useBudget((s) => s.projection)

  const outcomes = projection?.goalOutcomes ?? []
  const hasGoals = outcomes.length > 0

  const message = impact
    ? impact.headline
    : hasGoals
      ? summariseOutcomes(outcomes)
      : 'Add a goal to see what your plan buys you'

  const tone = impact ? (impact.deltaMonths < 0 ? 'good' : 'bad') : 'neutral'

  return (
    <div className="fixed inset-x-0 bottom-[3.5rem] z-30 px-3 pb-2 md:bottom-0 md:left-56 md:px-6 md:pb-4">
      <Link
        href="/future"
        key={impact?.headline ?? 'resting'}
        className={cn(
          'mx-auto flex max-w-2xl items-center gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-sm backdrop-blur transition-colors',
          impact && 'animate-impact',
          tone === 'good' && 'border-positive/30 bg-positive-soft/90 text-positive',
          tone === 'bad' && 'border-warn/30 bg-warn-soft/90 text-warn',
          tone === 'neutral' && 'bg-card/90 text-muted-foreground',
        )}
      >
        <IconSparkles className="size-4 shrink-0 self-start mt-0.5" stroke={2.2} />
        {/* Never truncated: this sentence is the point of the app. */}
        <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-balance">
          {message}
        </span>
        <IconArrowRight className="size-4 shrink-0 self-center opacity-60" stroke={2.2} />
      </Link>
    </div>
  )
}
