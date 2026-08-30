'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { RupeeField } from '@/components/rupee-field'
import { Button } from '@/components/ui/button'
import { createEmptyDoc, setAmountByName } from '@/lib/domain/factory'
import { newId } from '@/lib/domain/id'
import { addMonths, currentMonth, formatMonthLabel } from '@/lib/domain/month'
import { formatINR, toPaise } from '@/lib/domain/money'
import { useBudget } from '@/lib/state/store'
import { cn } from '@/lib/utils'
import type { BudgetDoc, Goal, Paise } from '@/lib/domain/types'

const EXPENSE_FIELDS = ['Rent', 'Utilities', 'Food', 'Transport', 'Subscriptions', 'Other'] as const

const GOAL_TEMPLATES = [
  { emoji: '🎓', name: "Master's", rupees: 2_000_000, yearsOut: 3 },
  { emoji: '🚗', name: 'Car', rupees: 800_000, yearsOut: 2 },
  { emoji: '✈️', name: 'Travel', rupees: 200_000, yearsOut: 1 },
  { emoji: '🛍️', name: 'Big purchase', rupees: 100_000, yearsOut: 1 },
] as const

type Expenses = Record<string, Paise>

export function OnboardingFlow() {
  const router = useRouter()
  const initialize = useBudget((s) => s.initialize)

  const [step, setStep] = useState(0)
  const [income, setIncome] = useState<Paise>(0)
  const [expenses, setExpenses] = useState<Expenses>({})
  const [balance, setBalance] = useState<Paise>(0)
  const [goal, setGoal] = useState<{
    emoji: string
    name: string
    amount: Paise
    targetMonth: string
  } | null>(null)

  const spent = Object.values(expenses).reduce((a, b) => a + b, 0)

  function finish() {
    const start = currentMonth()
    let doc: BudgetDoc = createEmptyDoc(start)
    doc = setAmountByName(doc, 'Salary', income / 100)
    for (const field of EXPENSE_FIELDS) {
      doc = setAmountByName(doc, field, (expenses[field] ?? 0) / 100)
    }

    const goals: Goal[] = goal
      ? [
          {
            id: newId('goal'),
            name: goal.name,
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
      goals,
      settings: {
        ...doc.settings,
        startingBalance: balance,
        // A starting suggestion, not a rule — changed in Setup at any time.
        monthlySavingTarget: Math.round((income * 0.2) / 1000) * 1000,
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
          hint="You can add freelance income, bonuses and anything else later."
          value={income}
          onChange={setIncome}
          autoFocus
        />
      ),
    },
    {
      title: 'Where does it go?',
      caption: 'Rough numbers are fine. Rename or delete any of these later.',
      canAdvance: true,
      body: (
        <div className="space-y-5">
          {EXPENSE_FIELDS.map((field) => (
            <RupeeField
              key={field}
              label={field}
              value={expenses[field] ?? 0}
              onChange={(next) => setExpenses((e) => ({ ...e, [field]: next }))}
            />
          ))}
          {income > 0 && (
            <p className="text-sm text-muted-foreground">
              That leaves{' '}
              <span className={cn('tnum font-medium', income - spent < 0 ? 'text-negative' : 'text-foreground')}>
                {formatINR(income - spent)}
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
          hint="Savings you can actually reach. You can correct this any time."
          value={balance}
          onChange={setBalance}
          autoFocus
        />
      ),
    },
    {
      title: 'What are you saving towards?',
      caption: 'One is enough to start. Add the rest later.',
      canAdvance: true,
      body: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {GOAL_TEMPLATES.map((template) => {
              const selected = goal?.name === template.name
              return (
                <button
                  key={template.name}
                  onClick={() =>
                    setGoal(
                      selected
                        ? null
                        : {
                            emoji: template.emoji,
                            name: template.name,
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
            <div className="space-y-4 rounded-xl border bg-card p-4">
              <RupeeField
                label={`How much for ${goal.name}?`}
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

      <div className="flex items-center gap-3 pt-8">
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
