'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'

import { RupeeField } from '@/components/rupee-field'
import { PercentField } from '@/components/setup/assumptions-section'
import { Section } from '@/components/setup/section'
import { Button } from '@/components/ui/button'
import { loanEMI, loanEndMonth, totalInterest } from '@/lib/domain/loan'
import { currentMonth, formatMonthLabel } from '@/lib/domain/month'
import { formatINR } from '@/lib/domain/money'
import { addLoan, removeLoan } from '@/lib/domain/mutations'
import { useBudget } from '@/lib/state/store'
import type { BudgetDoc, ISOMonth, Paise } from '@/lib/domain/types'

export function LoansSection({ doc }: { doc: BudgetDoc }) {
  const apply = useBudget((s) => s.apply)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [principal, setPrincipal] = useState<Paise>(0)
  const [annualRatePct, setRate] = useState(9)
  const [tenureMonths, setTenure] = useState(60)
  const [startMonth, setStart] = useState<ISOMonth>(currentMonth())

  function submit() {
    if (!name.trim() || principal <= 0) return
    apply((d) => addLoan(d, { name: name.trim(), principal, annualRatePct, tenureMonths, startMonth }))
    setName('')
    setPrincipal(0)
    setAdding(false)
  }

  return (
    <Section
      title="Loans"
      caption="Each one becomes a monthly payment that stops on its own."
      action={
        <Button size="sm" variant="outline" onClick={() => setAdding((a) => !a)}>
          <Plus className="size-4" />
          Add
        </Button>
      }
    >
      {adding && (
        <div className="mb-4 space-y-5 rounded-xl border bg-background p-4">
          <label className="block">
            <span className="label-xs">What is it for</span>
            <input
              autoFocus
              value={name}
              placeholder="Car loan"
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full border-b-2 bg-transparent pb-1 outline-none focus:border-primary placeholder:text-muted-foreground/50"
            />
          </label>

          <RupeeField label="Amount borrowed" value={principal} onChange={setPrincipal} />

          <div className="grid grid-cols-2 gap-4">
            <PercentField label="Interest" value={annualRatePct} onChange={setRate} />
            <PercentField label="Over" unit="months" value={tenureMonths} onChange={setTenure} />
          </div>

          <label className="block">
            <span className="label-xs">First payment</span>
            <input
              type="month"
              value={startMonth}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1.5 w-full border-b-2 bg-transparent pb-1 num-md outline-none focus:border-primary"
            />
          </label>

          {principal > 0 && (
            <p className="text-sm text-muted-foreground">
              <span className="tnum text-foreground">
                {formatINR(loanEMI({ id: '', name, principal, annualRatePct, tenureMonths, startMonth }))}
              </span>{' '}
              a month.
            </p>
          )}

          <Button className="w-full" onClick={submit} disabled={!name.trim() || principal <= 0}>
            Add loan
          </Button>
        </div>
      )}

      {doc.loans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No loans.</p>
      ) : (
        <ul className="space-y-2">
          {doc.loans.map((loan) => (
            <li key={loan.id} className="flex items-start gap-2 rounded-xl border bg-background p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{loan.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="tnum">{formatINR(loanEMI(loan))}</span> a month until{' '}
                  {formatMonthLabel(loanEndMonth(loan))} · costs{' '}
                  <span className="tnum">{formatINR(totalInterest(loan))}</span> in interest
                </p>
              </div>
              <button
                onClick={() => apply((d) => removeLoan(d, loan.id))}
                aria-label={`Remove ${loan.name}`}
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
