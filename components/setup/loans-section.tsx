'use client'

import { useState } from 'react'
import { IconPlus, IconX } from '@tabler/icons-react'

import { RupeeField } from '@/components/rupee-field'
import { PercentField } from '@/components/setup/assumptions-section'
import { Section } from '@/components/setup/section'
import { Button } from '@/components/ui/button'
import { loanEMI, loanEndMonth, monthsRemaining, totalInterest } from '@/lib/domain/loan'
import { currentMonth, formatMonthLabel } from '@/lib/domain/month'
import { formatINR } from '@/lib/domain/money'
import { addLoan, removeLoan, updateLoan } from '@/lib/domain/mutations'
import { useBudget } from '@/lib/state/store'
import { cn } from '@/lib/utils'
import type { BudgetDoc, ISOMonth, Loan, LoanSpec, Paise } from '@/lib/domain/types'

export function LoansSection({ doc }: { doc: BudgetDoc }) {
  const apply = useBudget((s) => s.apply)
  const [adding, setAdding] = useState(false)
  const [mode, setMode] = useState<LoanSpec['mode']>('emi')
  const [name, setName] = useState('')
  const [emi, setEmi] = useState<Paise>(0)
  const [principal, setPrincipal] = useState<Paise>(0)
  const [annualRatePct, setRate] = useState(9)
  const [tenureMonths, setTenure] = useState(36)
  const [startMonth, setStart] = useState<ISOMonth>(currentMonth())

  function submit() {
    if (!name.trim() || tenureMonths <= 0) return
    const spec: LoanSpec =
      mode === 'emi' ? { mode: 'emi', emi } : { mode: 'principal', principal, annualRatePct }
    if (mode === 'emi' ? emi <= 0 : principal <= 0) return
    apply((d) => addLoan(d, { name: name.trim(), spec, tenureMonths, startMonth }))
    setName('')
    setEmi(0)
    setPrincipal(0)
    setAdding(false)
  }

  return (
    <Section
      title="Loans"
      caption="Each one becomes a monthly payment that stops on its own."
      action={
        <Button size="sm" variant="outline" onClick={() => setAdding((a) => !a)}>
          <IconPlus className="size-4" />
          Add
        </Button>
      }
    >
      {adding && (
        <div className="mb-4 space-y-5 rounded-xl border bg-background p-4">
          <div className="flex rounded-lg bg-muted p-0.5">
            {(
              [
                { key: 'emi', label: 'I know the EMI' },
                { key: 'principal', label: 'I know the terms' },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                onClick={() => setMode(option.key)}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  mode === option.key ? 'bg-card shadow-sm' : 'text-muted-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

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

          {mode === 'emi' ? (
            <>
              <RupeeField
                label="Leaves your account each month"
                value={emi}
                onChange={setEmi}
              />
              <PercentField
                label="Months still to pay"
                unit="months"
                hint="The app works out the exact month it ends."
                value={tenureMonths}
                onChange={setTenure}
              />
            </>
          ) : (
            <>
              <RupeeField label="Amount borrowed" value={principal} onChange={setPrincipal} />
              <div className="grid grid-cols-2 gap-4">
                <PercentField label="Interest" value={annualRatePct} onChange={setRate} />
                <PercentField
                  label="Over"
                  unit="months"
                  value={tenureMonths}
                  onChange={setTenure}
                />
              </div>
            </>
          )}

          <label className="block">
            <span className="label-xs">
              {mode === 'emi' ? 'Counting from' : 'First payment'}
            </span>
            <input
              type="month"
              value={startMonth}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1.5 w-full border-b-2 bg-transparent pb-1 num-md outline-none focus:border-primary"
            />
          </label>

          <Button className="w-full" onClick={submit} disabled={!name.trim()}>
            Add loan
          </Button>
        </div>
      )}

      {doc.loans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No loans.</p>
      ) : (
        <ul className="space-y-2">
          {doc.loans.map((loan) => (
            <LoanRow key={loan.id} loan={loan} />
          ))}
        </ul>
      )}
    </Section>
  )
}

function LoanRow({ loan }: { loan: Loan }) {
  const apply = useBudget((s) => s.apply)
  const interest = totalInterest(loan)
  const left = monthsRemaining(loan, currentMonth())

  return (
    <li className="rounded-xl border bg-background p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{loan.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="tnum">{formatINR(loanEMI(loan))}</span> a month · ends{' '}
            {formatMonthLabel(loanEndMonth(loan))}
            {interest !== null && (
              <>
                {' '}
                · <span className="tnum">{formatINR(interest)}</span> in interest
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => apply((d) => removeLoan(d, loan.id))}
          aria-label={`Remove ${loan.name}`}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <IconX className="size-3.5" />
        </button>
      </div>

      {/* The number worth changing most often, right where you can see it. */}
      <div className="mt-3 flex items-center gap-2 border-t pt-3">
        <span className="label-xs flex-1">Months still to pay</span>
        <input
          inputMode="decimal"
          aria-label={`Months still to pay on ${loan.name}`}
          value={left}
          onChange={(e) => {
            const next = Number(e.target.value)
            if (!Number.isFinite(next) || next < 0) return
            // Re-anchor to today so "months left" means what it says.
            apply((d) =>
              updateLoan(d, loan.id, { tenureMonths: next, startMonth: currentMonth() }),
            )
          }}
          className="w-16 rounded-md bg-transparent px-2 py-1 text-right num-md outline-none focus:bg-accent/70"
        />
      </div>
    </li>
  )
}
