'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Lock, LockOpen, Plus, X } from 'lucide-react'

import { CadenceField } from '@/components/onboarding/cadence-field'
import { RupeeField } from '@/components/rupee-field'
import { Button } from '@/components/ui/button'
import { cadenceToVersions, type Cadence } from '@/lib/domain/cadence'
import {
  SEED_CATEGORIES,
  SEED_LOAN,
  createEmptyDoc,
  setLineVersionsByName,
  type SeedStep,
} from '@/lib/domain/factory'
import { newId } from '@/lib/domain/id'
import { addMonths, currentMonth, formatMonthLabel } from '@/lib/domain/month'
import { formatINR, toPaise } from '@/lib/domain/money'
import { addCategory } from '@/lib/domain/mutations'
import { useBudget } from '@/lib/state/store'
import { cn } from '@/lib/utils'
import type { BudgetDoc, Goal, LineKind, Loan, Paise } from '@/lib/domain/types'

interface Extra {
  id: string
  step: SeedStep
  name: string
  amount: Paise
  cadence: Cadence
  kind: LineKind
}

interface LoanDraft {
  id: string
  name: string
  emi: Paise
  monthsLeft: number
}

const GROUP_FOR_STEP: Record<SeedStep, string> = {
  income: 'Income',
  home: 'Home',
  fixed: 'Family & cover',
  living: 'Daily',
  investments: 'Investments',
}

const HORIZONS = [
  { years: 3, label: '3 years', caption: 'Near-term plans' },
  { years: 5, label: '5 years', caption: 'The usual choice' },
  { years: 10, label: '10 years', caption: 'A degree, a house' },
]

const GOAL_TEMPLATES = [
  { emoji: '🎓', name: "Master's", rupees: 2_000_000, yearsOut: 3 },
  { emoji: '🚗', name: 'Car', rupees: 800_000, yearsOut: 2 },
  { emoji: '✈️', name: 'Travel', rupees: 200_000, yearsOut: 1 },
  { emoji: '🎯', name: 'Something else', rupees: 100_000, yearsOut: 1, custom: true },
] as const

function seedsFor(step: SeedStep) {
  return SEED_CATEGORIES.filter((c) => c.step === step)
}

export function OnboardingFlow() {
  const router = useRouter()
  const initialize = useBudget((s) => s.initialize)
  const startMonth = useMemo(() => currentMonth(), [])

  const [step, setStep] = useState(0)
  const [horizonYears, setHorizonYears] = useState(5)

  const [amounts, setAmounts] = useState<Record<string, Paise>>(() =>
    Object.fromEntries(SEED_CATEGORIES.map((c) => [c.name, toPaise(c.rupees ?? 0)])),
  )
  const [cadences, setCadences] = useState<Record<string, Cadence>>(() =>
    Object.fromEntries(
      SEED_CATEGORIES.map((c) => [
        c.name,
        c.defaultGrowthPct > 0
          ? ({ mode: 'grows', ratePct: c.defaultGrowthPct } as Cadence)
          : ({ mode: 'flat' } as Cadence),
      ]),
    ),
  )
  const [locked, setLocked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SEED_CATEGORIES.map((c) => [c.name, Boolean(c.locked)])),
  )
  const [extras, setExtras] = useState<Extra[]>([])
  const [loans, setLoans] = useState<LoanDraft[]>([
    { id: newId('l'), name: SEED_LOAN.name, emi: toPaise(SEED_LOAN.rupees), monthsLeft: SEED_LOAN.defaultMonthsLeft },
  ])
  const [balance, setBalance] = useState<Paise>(0)
  const [goal, setGoal] = useState<{
    emoji: string
    name: string
    amount: Paise
    targetMonth: string
  } | null>(null)

  const horizonMonths = horizonYears * 12

  function amountsForStep(target: SeedStep) {
    return (
      seedsFor(target).reduce((a, c) => a + (amounts[c.name] ?? 0), 0) +
      extras.filter((e) => e.step === target).reduce((a, e) => a + e.amount, 0)
    )
  }

  const income = amountsForStep('income')
  const emiTotal = loans.reduce((a, l) => a + l.emi, 0)
  const spending = amountsForStep('home') + amountsForStep('fixed') + amountsForStep('living')
  const investing = amountsForStep('investments')
  const leftover = income - spending - investing - emiTotal

  function addExtra(target: SeedStep, kind: LineKind) {
    setExtras((list) => [
      ...list,
      { id: newId('x'), step: target, name: '', amount: 0, cadence: { mode: 'flat' }, kind },
    ])
  }

  function finish() {
    let doc: BudgetDoc = createEmptyDoc(startMonth)

    for (const seed of SEED_CATEGORIES) {
      doc = setLineVersionsByName(
        doc,
        seed.name,
        cadenceToVersions(startMonth, amounts[seed.name] ?? 0, cadences[seed.name], seed.name),
      )
      if (seed.kind === 'investment') {
        doc = {
          ...doc,
          categories: doc.categories.map((c) =>
            c.name === seed.name ? { ...c, locked: locked[seed.name] } : c,
          ),
        }
      }
    }

    for (const extra of extras) {
      if (!extra.name.trim()) continue
      doc = addCategory(doc, {
        name: extra.name.trim(),
        kind: extra.kind,
        groupId:
          doc.groups.find((g) => g.name === GROUP_FOR_STEP[extra.step])?.id ?? doc.groups[0].id,
        from: startMonth,
      })
      doc = setLineVersionsByName(
        doc,
        extra.name.trim(),
        cadenceToVersions(startMonth, extra.amount, extra.cadence, extra.name.trim()),
      )
    }

    const builtLoans: Loan[] = loans
      .filter((l) => l.emi > 0 && l.monthsLeft > 0)
      .map((l) => ({
        id: newId('loan'),
        name: l.name.trim() || 'Loan',
        spec: { mode: 'emi', emi: l.emi },
        tenureMonths: l.monthsLeft,
        startMonth,
      }))

    const goals: Goal[] =
      goal && goal.name.trim()
        ? [
            {
              id: newId('goal'),
              name: goal.name.trim(),
              emoji: goal.emoji,
              targetAmount: goal.amount,
              targetMonth: goal.targetMonth,
              priority: 0,
              funding: 'savings',
              status: 'active',
            },
          ]
        : []

    initialize({
      ...doc,
      loans: builtLoans,
      goals,
      settings: {
        ...doc.settings,
        startingBalance: balance,
        horizonMonths,
        defaultViewMonths: Math.min(60, horizonMonths),
        monthlySavingTarget: Math.max(0, Math.round(leftover / 100_000) * 100_000),
      },
      onboardedAt: new Date().toISOString().slice(0, 10),
    })
    router.replace('/')
  }

  function seedFields(target: SeedStep) {
    return (
      <div className="space-y-7">
        {seedsFor(target).map((seed) => (
          <div key={seed.name}>
            <CadenceField
              label={seed.name}
              value={amounts[seed.name] ?? 0}
              onChange={(next) => setAmounts((a) => ({ ...a, [seed.name]: next }))}
              cadence={cadences[seed.name]}
              onCadenceChange={(next) => setCadences((c) => ({ ...c, [seed.name]: next }))}
              startMonth={startMonth}
              horizonMonths={horizonMonths}
              defaultGrowthPct={seed.defaultGrowthPct}
            />
            {seed.kind === 'investment' && (
              <button
                type="button"
                onClick={() => setLocked((l) => ({ ...l, [seed.name]: !l[seed.name] }))}
                className={cn(
                  'mt-2 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                  locked[seed.name]
                    ? 'border-warn/40 bg-warn-soft text-warn'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {locked[seed.name] ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
                {locked[seed.name] ? 'Locked away — goals can’t use it' : 'Goals can use it'}
              </button>
            )}
          </div>
        ))}

        {extras
          .filter((e) => e.step === target)
          .map((extra) => (
            <div key={extra.id} className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={extra.name}
                  placeholder="What is it?"
                  onChange={(e) =>
                    setExtras((list) =>
                      list.map((x) => (x.id === extra.id ? { ...x, name: e.target.value } : x)),
                    )
                  }
                  className="min-w-0 flex-1 border-b-2 bg-transparent pb-1 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50"
                />
                <button
                  type="button"
                  onClick={() => setExtras((list) => list.filter((x) => x.id !== extra.id))}
                  aria-label="Remove this line"
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="mt-4">
                <CadenceField
                  label="Amount"
                  value={extra.amount}
                  onChange={(amount) =>
                    setExtras((list) =>
                      list.map((x) => (x.id === extra.id ? { ...x, amount } : x)),
                    )
                  }
                  cadence={extra.cadence}
                  onCadenceChange={(cadence) =>
                    setExtras((list) =>
                      list.map((x) => (x.id === extra.id ? { ...x, cadence } : x)),
                    )
                  }
                  startMonth={startMonth}
                  horizonMonths={horizonMonths}
                  defaultGrowthPct={6}
                />
              </div>
            </div>
          ))}

        <button
          type="button"
          onClick={() => addExtra(target, target === 'investments' ? 'investment' : target === 'income' ? 'income' : 'expense')}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-4" />
          Add another
        </button>
      </div>
    )
  }

  const runningTotal = income > 0 && (
    <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
      <span className="tnum">{formatINR(spending + emiTotal)}</span> spent ·{' '}
      <span className="tnum">{formatINR(investing)}</span> invested · leaves{' '}
      <span className={cn('tnum font-medium', leftover < 0 ? 'text-negative' : 'text-foreground')}>
        {formatINR(leftover)}
      </span>
    </p>
  )

  const steps = [
    {
      name: 'Horizon',
      title: 'How far ahead do you want to plan?',
      caption: 'Everything after this is entered against that span. You can change it later.',
      canAdvance: horizonYears > 0,
      body: (
        <div className="space-y-3">
          {HORIZONS.map((option) => (
            <button
              key={option.years}
              type="button"
              onClick={() => setHorizonYears(option.years)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors',
                horizonYears === option.years
                  ? 'border-primary bg-primary/5'
                  : 'bg-card hover:bg-accent',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.caption}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                to {formatMonthLabel(addMonths(startMonth, option.years * 12 - 1))}
              </span>
            </button>
          ))}
          <label className="block pt-2">
            <span className="label-xs">Or pick your own</span>
            <div className="mt-1.5 flex items-baseline gap-1 border-b-2 pb-1 focus-within:border-primary">
              <input
                inputMode="decimal"
                value={horizonYears}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  if (Number.isFinite(next) && next >= 1 && next <= 30) setHorizonYears(next)
                }}
                className="w-full bg-transparent num-lg outline-none"
              />
              <span className="text-sm text-muted-foreground">years</span>
            </div>
          </label>
        </div>
      ),
    },
    {
      name: 'Income',
      title: 'What comes in?',
      caption: 'In-hand, after tax. Not your CTC.',
      canAdvance: income > 0,
      body: seedFields('income'),
    },
    {
      name: 'Home',
      title: 'Home and bills',
      caption: 'Rent usually climbs. The others move with prices.',
      canAdvance: true,
      body: (
        <div className="space-y-6">
          {seedFields('home')}
          {runningTotal}
        </div>
      ),
    },
    {
      name: 'Loans',
      title: 'Loans and EMIs',
      caption: 'The month one ends is the month that money comes back to you.',
      canAdvance: loans.every((l) => l.monthsLeft > 0),
      body: (
        <div className="space-y-4">
          {loans.map((loan) => (
            <div key={loan.id} className="space-y-5 rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2">
                <input
                  value={loan.name}
                  placeholder="Home loan"
                  onChange={(e) =>
                    setLoans((list) =>
                      list.map((l) => (l.id === loan.id ? { ...l, name: e.target.value } : l)),
                    )
                  }
                  className="min-w-0 flex-1 border-b-2 bg-transparent pb-1 text-sm outline-none focus:border-primary"
                />
                {loans.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLoans((list) => list.filter((l) => l.id !== loan.id))}
                    aria-label={`Remove ${loan.name}`}
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <RupeeField
                label="Leaves your account monthly"
                value={loan.emi}
                onChange={(emi) =>
                  setLoans((list) => list.map((l) => (l.id === loan.id ? { ...l, emi } : l)))
                }
              />

              <label className="block">
                <span className="label-xs">Months still to pay</span>
                <input
                  inputMode="decimal"
                  value={loan.monthsLeft}
                  onChange={(e) => {
                    const next = Number(e.target.value)
                    if (Number.isFinite(next) && next >= 0)
                      setLoans((list) =>
                        list.map((l) => (l.id === loan.id ? { ...l, monthsLeft: next } : l)),
                      )
                  }}
                  className="mt-1.5 w-full border-b-2 bg-transparent pb-1 num-lg outline-none focus:border-primary"
                />
                <span className="mt-1.5 block text-xs text-muted-foreground">
                  {loan.monthsLeft > 0 ? (
                    <>
                      Paid off {formatMonthLabel(addMonths(startMonth, loan.monthsLeft - 1))} — then{' '}
                      <span className="text-foreground">{formatINR(loan.emi)}</span> a month is
                      yours again.
                    </>
                  ) : (
                    'This is the number that most changes your future. Worth checking.'
                  )}
                </span>
              </label>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setLoans((list) => [
                ...list,
                { id: newId('l'), name: '', emi: 0, monthsLeft: 12 },
              ])
            }
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-4" />
            Add another loan
          </button>
          {runningTotal}
        </div>
      ),
    },
    {
      name: 'Fixed',
      title: 'Fixed monthly commitments',
      caption: 'Things that stay put until you change them.',
      canAdvance: true,
      body: (
        <div className="space-y-6">
          {seedFields('fixed')}
          {runningTotal}
        </div>
      ),
    },
    {
      name: 'Living',
      title: 'Everyday spending',
      caption: 'These drift up with prices unless you say otherwise.',
      canAdvance: true,
      body: (
        <div className="space-y-6">
          {seedFields('living')}
          {runningTotal}
        </div>
      ),
    },
    {
      name: 'Investing',
      title: 'What you put away',
      caption: 'This money leaves your account but stays yours.',
      canAdvance: true,
      body: (
        <div className="space-y-6">
          {seedFields('investments')}
          {runningTotal}
        </div>
      ),
    },
    {
      name: 'Balance',
      title: "What's in your account right now?",
      caption: 'The starting point everything is measured from.',
      canAdvance: true,
      body: (
        <RupeeField
          label="Current balance"
          hint="Cash you can actually reach."
          value={balance}
          onChange={setBalance}
          autoFocus
        />
      ),
    },
    {
      name: 'Goals',
      title: 'What are you saving towards?',
      caption: 'One is enough to start. Add the rest later.',
      canAdvance: !goal || goal.name.trim().length > 0,
      body: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {GOAL_TEMPLATES.map((template) => {
              const custom = 'custom' in template && template.custom
              const selected = custom
                ? goal !== null && !GOAL_TEMPLATES.some((t) => t.name === goal.name)
                : goal?.name === template.name
              return (
                <button
                  key={template.name}
                  type="button"
                  onClick={() =>
                    setGoal(
                      selected
                        ? null
                        : {
                            emoji: template.emoji,
                            name: custom ? '' : template.name,
                            amount: toPaise(template.rupees),
                            targetMonth: addMonths(
                              startMonth,
                              Math.min(template.yearsOut, horizonYears) * 12,
                            ),
                          },
                    )
                  }
                  className={cn(
                    'rounded-xl border p-3 text-left transition-colors',
                    selected ? 'border-primary bg-primary/5' : 'bg-card hover:bg-accent',
                  )}
                >
                  <span className="text-xl">{template.emoji}</span>
                  <span className="mt-1 block text-sm font-medium">{template.name}</span>
                </button>
              )
            })}
          </div>

          {goal && (
            <div className="space-y-5 rounded-xl border bg-card p-4">
              <label className="block">
                <span className="label-xs">Call it</span>
                <input
                  autoFocus={!goal.name}
                  value={goal.name}
                  placeholder="A house deposit"
                  onChange={(e) => setGoal({ ...goal, name: e.target.value })}
                  className="mt-1.5 w-full border-b-2 bg-transparent pb-1 text-lg outline-none focus:border-primary placeholder:text-muted-foreground/50"
                />
              </label>
              <RupeeField
                label="How much"
                value={goal.amount}
                onChange={(amount) => setGoal({ ...goal, amount })}
              />
              <label className="block">
                <span className="label-xs">Wanted by</span>
                <input
                  type="month"
                  value={goal.targetMonth}
                  max={addMonths(startMonth, horizonMonths - 1)}
                  onChange={(e) => setGoal({ ...goal, targetMonth: e.target.value })}
                  className="mt-1.5 w-full border-b-2 bg-transparent pb-1 num-md outline-none focus:border-primary"
                />
              </label>
            </div>
          )}
        </div>
      ),
    },
  ]

  const active = steps[step]
  const last = step === steps.length - 1

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-safe">
      <div className="sticky top-0 z-10 bg-background pb-3 pt-6">
        <div className="flex gap-1">
          {steps.map((s, i) => (
            <div
              key={s.name}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i < step ? 'bg-primary' : i === step ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>
        <p className="label-xs mt-2.5">
          {active.name} · step {step + 1} of {steps.length}
        </p>
      </div>

      <div className="flex-1 pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">{active.title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{active.caption}</p>
        <div className="mt-8">{active.body}</div>
      </div>

      <div className="sticky bottom-0 flex items-center gap-3 bg-background pb-2 pt-8">
        {step > 0 && (
          <Button variant="ghost" size="lg" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
        )}
        <Button
          size="lg"
          className="flex-1"
          disabled={!active.canAdvance}
          onClick={() => (last ? finish() : setStep((s) => s + 1))}
        >
          {last ? 'Start planning' : 'Next'}
          {!last && <ArrowRight className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
