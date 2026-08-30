'use client'

import { RupeeField } from '@/components/rupee-field'
import { Section } from '@/components/setup/section'
import { addMonths, formatMonthLabel } from '@/lib/domain/month'
import { updateSettings } from '@/lib/domain/mutations'
import { useBudget } from '@/lib/state/store'
import type { BudgetDoc } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

export function AssumptionsSection({ doc }: { doc: BudgetDoc }) {
  const apply = useBudget((s) => s.apply)
  const { settings } = doc

  return (
    <Section
      title="Assumptions"
      caption="The few numbers the forecast leans on. All optional."
    >
      <div className="space-y-6">
        <div>
          <p className="label-xs">How far ahead you plan</p>
          <div className="mt-2 flex rounded-lg bg-muted p-0.5">
            {[3, 5, 10].map((years) => (
              <button
                key={years}
                onClick={() =>
                  apply((d) =>
                    updateSettings(d, {
                      horizonMonths: years * 12,
                      defaultViewMonths: Math.min(60, years * 12),
                    }),
                  )
                }
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  settings.horizonMonths === years * 12
                    ? 'bg-card shadow-sm'
                    : 'text-muted-foreground',
                )}
              >
                {years} years
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            The forecast runs to{' '}
            {formatMonthLabel(addMonths(settings.startMonth, settings.horizonMonths - 1))}.
          </p>
        </div>

        <RupeeField
          label="Monthly saving target"
          hint="What you want left over each month. Only a marker to aim at."
          value={settings.monthlySavingTarget}
          onChange={(monthlySavingTarget) =>
            apply((d) => updateSettings(d, { monthlySavingTarget }))
          }
        />

        <div className="rounded-2xl border border-dashed p-3">
          <p className="text-xs text-muted-foreground">
            These are all <span className="text-foreground">off unless you set them</span>. Nothing
            in your plan goes up on its own — set a rate here to apply it across the board, or give
            a single line its own on the Budget screen.
          </p>
        </div>

        <PercentField
          label="Prices rise by"
          hint="Applied each year to everyday spending. Zero means today's prices, forever."
          value={settings.inflationRatePct}
          onChange={(inflationRatePct) => apply((d) => updateSettings(d, { inflationRatePct }))}
        />

        <PercentField
          label="Pay rises by"
          hint="Applied to income each year. Zero assumes no raises."
          value={settings.incomeGrowthRatePct}
          onChange={(incomeGrowthRatePct) =>
            apply((d) => updateSettings(d, { incomeGrowthRatePct }))
          }
        />

        <PercentField
          label="Savings grow by"
          hint="One number for everything you hold. Zero ignores returns entirely."
          value={settings.expectedAnnualReturnPct}
          onChange={(expectedAnnualReturnPct) =>
            apply((d) => updateSettings(d, { expectedAnnualReturnPct }))
          }
        />

        <div>
          <p className="label-xs">Never spend below</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A floor your goals are not allowed to cross.
          </p>
          <div className="mt-3 flex rounded-lg bg-muted p-0.5">
            {(['monthsOfExpenses', 'fixed'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() =>
                  apply((d) =>
                    updateSettings(d, {
                      safetyFloor:
                        mode === 'fixed'
                          ? { mode: 'fixed', amount: 100_000_00 }
                          : { mode: 'monthsOfExpenses', months: 3 },
                    }),
                  )
                }
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  settings.safetyFloor.mode === mode
                    ? 'bg-card shadow-sm'
                    : 'text-muted-foreground',
                )}
              >
                {mode === 'fixed' ? 'A fixed amount' : 'Months of spending'}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {settings.safetyFloor.mode === 'fixed' ? (
              <RupeeField
                label="Keep at least"
                value={settings.safetyFloor.amount}
                onChange={(amount) =>
                  apply((d) => updateSettings(d, { safetyFloor: { mode: 'fixed', amount } }))
                }
              />
            ) : (
              <PercentField
                label="Months of spending to keep"
                unit="months"
                value={settings.safetyFloor.months}
                onChange={(months) =>
                  apply((d) =>
                    updateSettings(d, { safetyFloor: { mode: 'monthsOfExpenses', months } }),
                  )
                }
              />
            )}
          </div>
        </div>
      </div>
    </Section>
  )
}

export function PercentField({
  label,
  hint,
  value,
  onChange,
  unit = '%',
}: {
  label: string
  hint?: string
  value: number
  onChange: (next: number) => void
  unit?: string
}) {
  return (
    <label className="block">
      <span className="label-xs">{label}</span>
      <div className="mt-1.5 flex items-baseline gap-1 border-b-2 pb-1 focus-within:border-primary">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value)
            if (Number.isFinite(next)) onChange(next)
          }}
          className="w-full bg-transparent num-lg outline-none"
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}
