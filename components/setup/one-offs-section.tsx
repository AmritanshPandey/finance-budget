'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'

import { RupeeField } from '@/components/rupee-field'
import { Section } from '@/components/setup/section'
import { Button } from '@/components/ui/button'
import { addMonths, compareMonth, currentMonth, formatMonthLabel } from '@/lib/domain/month'
import { formatINR } from '@/lib/domain/money'
import { addOneOff, removeOneOff } from '@/lib/domain/mutations'
import { useBudget } from '@/lib/state/store'
import { cn } from '@/lib/utils'
import type { BudgetDoc, ISOMonth, Paise } from '@/lib/domain/types'

/** Bonuses, freelance work, a wedding to pay for — money that arrives once. */
export function OneOffsSection({ doc }: { doc: BudgetDoc }) {
  const apply = useBudget((s) => s.apply)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState<Paise>(0)
  const [month, setMonth] = useState<ISOMonth>(addMonths(currentMonth(), 1))
  const [direction, setDirection] = useState<'in' | 'out'>('in')

  const oneOffs = [...doc.oneOffs].sort((a, b) => compareMonth(a.month, b.month))

  function submit() {
    if (!label.trim() || amount <= 0) return
    apply((d) => addOneOff(d, { label: label.trim(), amount, month, direction }))
    setLabel('')
    setAmount(0)
    setAdding(false)
  }

  return (
    <Section
      title="One-off money"
      caption="A bonus, a gift, a big bill. Lands in one month only."
      action={
        <Button size="sm" variant="outline" onClick={() => setAdding((a) => !a)}>
          <Plus className="size-4" />
          Add
        </Button>
      }
    >
      {adding && (
        <div className="mb-4 space-y-5 rounded-xl border bg-background p-4">
          <div className="flex rounded-lg bg-muted p-0.5">
            {(
              [
                { key: 'in', label: 'Money in' },
                { key: 'out', label: 'Money out' },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                onClick={() => setDirection(option.key)}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  direction === option.key ? 'bg-card shadow-sm' : 'text-muted-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="label-xs">What is it</span>
            <input
              autoFocus
              value={label}
              placeholder="Annual bonus"
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1.5 w-full border-b-2 bg-transparent pb-1 outline-none focus:border-primary placeholder:text-muted-foreground/50"
            />
          </label>

          <RupeeField label="How much" value={amount} onChange={setAmount} />

          <label className="block">
            <span className="label-xs">When</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1.5 w-full border-b-2 bg-transparent pb-1 num-md outline-none focus:border-primary"
            />
          </label>

          <Button className="w-full" onClick={submit} disabled={!label.trim() || amount <= 0}>
            Add it
          </Button>
        </div>
      )}

      {oneOffs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
      ) : (
        <ul className="space-y-1.5">
          {oneOffs.map((oneOff) => (
            <li key={oneOff.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{oneOff.label}</span>
              <span className="text-xs text-muted-foreground">
                {formatMonthLabel(oneOff.month)}
              </span>
              <span
                className={cn(
                  'w-24 text-right num-md',
                  oneOff.direction === 'in' ? 'text-positive' : 'text-foreground',
                )}
              >
                {oneOff.direction === 'in' ? '+' : '−'}
                {formatINR(oneOff.amount)}
              </span>
              <button
                onClick={() => apply((d) => removeOneOff(d, oneOff.id))}
                aria-label={`Remove ${oneOff.label}`}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
