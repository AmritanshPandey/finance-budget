'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react'

import { RupeeField } from '@/components/rupee-field'
import { Button } from '@/components/ui/button'
import {
  SEED_CATEGORIES,
  SEED_LOAN,
  createEmptyDoc,
  setAmountByName,
} from '@/lib/domain/factory'
import { newId } from '@/lib/domain/id'
import { addMonths, currentMonth, formatMonthLabel } from '@/lib/domain/month'
import { formatINR, toPaise } from '@/lib/domain/money'
import { useBudget } from '@/lib/state/store'
import { cn } from '@/lib/utils'
import type { BudgetDoc, Goal, Loan, Paise } from '@/lib/domain/types'

const OUTGOINGS = SEED_CATEGORIES.filter((c) => c.kind !== 'income')

const GOAL_TEMPLATES = [
  { emoji: '🎓', name: "Master's", rupees: 2_000_000, yearsOut: 3 },
  { emoji: '🚗', name: 'Car', rupees: 800_000, yearsOut: 2 },
  { emoji: '✈️', name: 'Travel', rupees: 200_000, yearsOut: 1 },
  { emoji: '🎯', name: 'Something else', rupees: 100_000, yearsOut: 1, custom: true },
] as const

export function OnboardingFlow() {
  const router = useRouter()
  const initialize = useBudget((s) => s.initialize)

  const [step, setStep] = useState(0)
  const [income, setIncome] = useState<Paise>(0)
  const [amounts, setAmounts] = useState<Record<string, Paise>>(() =>
    Object.fromEntries(OUTGOINGS.map((c) => [c.name, toPaise(c.rupees ?? 0)])),
  )
  const [emi, setEmi] = useState<Paise>(toPaise(SEED_LOAN.rupees))
  const [monthsLeft, setMonthsLeft] = useState(SEED_LOAN.defaultMonthsLeft)
  const [balance, setBalance] = useState<Paise>(0)
  const [goal, setGoal] = useState<{
    emoji: string
    name: string
    amount: Paise
    targetMonth: string
  } | null>(null)

  const spending = OUTGOINGS.filter((c) => c.kind === 'expense').reduce(
    (a, c) => a + (amounts[c.name] ?? 0),
    0,
  )
  const investing = OUTGOINGS.filter((c) => c.kind === 'investment').reduce(
    (a, c) => a + (amounts[c.name] ?? 0),
    0,
  )
  const leftover = income - spending - investing - emi

  function finish() {
    const start = currentMonth()
    let doc: BudgetDoc = createEmptyDoc(start)
    doc = setAmountByName(doc, 'Salary', income / 100)
    for (const seed of OUTGOINGS) {
      doc = setAmountByName(doc, seed.name, (amounts[seed.name] ?? 0) / 100)
    }

    const loans: Loan[] =
      emi > 0 && monthsLeft > 0
        ? [
            {
              id: newId('loan'),
              name: SEED_LOAN.name,
              spec: { mode: 'emi', emi },
              tenureMonths: monthsLeft,
              startMonth: start,
            },
          ]
        : []

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
      loans,
      goals,
      settings: {
        ...doc.settings,
        startingBalance: balance,
        // A starting suggestion, not a rule — changed in Setup at any time.
        monthlySavingTarget: Math.max(0, Math.round(leftover / 100_000) * 100_000),
      },
      onboardedAt: new Date().toISOString().slice(0, 10),
    })
    router.replace('/')
  }

  const steps = [
    {
      title: 'What lands in your account each month?',
      caption: 'In-hand, after tax. Not your CTC.',
      canAdvance: income > 0,
      body: (
        <RupeeField
          label="Monthly income"
          hint="Bonuses and freelance work go in later, as one-off money."
          value={income}
          onChange={setIncome}
          autoFocus
        />
      ),
    },
    {
      title: 'Does this look right?',
      caption: 'Already filled in from your budget. Change anything that has moved.',
      canAdvance: monthsLeft > 0,
      body: (
        <div className="space-y-8">
          <div className="rounded-xl border bg-card p-4">
            <RupeeField label="Loan — leaves your account monthly" value={emi} onChange={setEmi} />
            <label className="mt-5 block">
              <span className="label-xs">Months still to pay</span>
              <input
                inputMode="decimal"
                value={monthsLeft}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  if (Number.isFinite(next) && next >= 0) setMonthsLeft(next)
                }}
                className="mt-1.5 w-full border-b-2 bg-transparent pb-1 num-lg outline-none focus:border-primary"
              />
              <span className="mt-1.5 block text-xs text-muted-foreground">
                {monthsLeft > 0 ? (
                  <>
                    Paid off {formatMonthLabel(addMonths(currentMonth(), monthsLeft - 1))} — then{' '}
                    <span className="text-foreground">{formatINR(emi)}</span> a month comes back
                    to you.
                  </>
                ) : (
                  'This is the one number that most changes your future. Worth checking.'
                )}
              </span>
            </label>
          </div>

          {[...new Set(OUTGOINGS.map((c) => c.group))].map((group) => (
            <div key={group}>
              <p className="label-xs">{group}</p>
              <div className="mt-3 space-y-5">
                {OUTGOINGS.filter((c) => c.group === group).map((seed) => (
                  <div key={seed.name}>
                    <RupeeField
                      label={seed.name}
                      value={amounts[seed.name] ?? 0}
                      onChange={(next) => setAmounts((a) => ({ ...a, [seed.name]: next }))}
                    />
                    {seed.kind === 'investment' && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="size-3" />
                        {seed.locked
                          ? 'Invested and locked away — goals can’t use it'
                          : 'Invested — still counts toward your goals'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {income > 0 && (
            <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
              <span className="tnum">{formatINR(spending + emi)}</span> spent ·{' '}
              <span className="tnum">{formatINR(investing)}</span> invested · leaves{' '}
              <span className={cn('tnum font-medium', leftover < 0 ? 'text-negative' : 'text-foreground')}>
                {formatINR(leftover)}
              </span>{' '}
              a month.
            </p>
          )}
        </div>
      ),
    },
    {
      title: "What's in your account right now?",
      caption: 'The starting point everything is measured from.',
      canAdvance: true,
      body: (
        <RupeeField
          label="Current balance"
          hint="Cash you can actually reach. Investments you already hold come later."
          value={balance}
          onChange={setBalance}
          autoFocus
        />
      ),
    },
    {
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
                  onClick={() =>
                    setGoal(
                      selected
                        ? null
                        : {
                            emoji: template.emoji,
                            name: custom ? '' : template.name,
                            amount: toPaise(template.rupees),
                            targetMonth: addMonths(currentMonth(), template.yearsOut * 12),
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
                  onChange={(e) => setGoal({ ...goal, targetMonth: e.target.value })}
                  className="mt-1.5 w-full border-b-2 bg-transparent pb-1 num-md outline-none focus:border-primary"
                />
                <span className="mt-1.5 block text-xs text-muted-foreground">
                  {formatMonthLabel(goal.targetMonth)}
                </span>
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
      <div className="flex gap-1.5 pt-6">
        {steps.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i <= step ? 'bg-primary' : 'bg-muted',
            )}
          />
        ))}
      </div>

      <div className="flex-1 pt-10">
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
