'use client'

import { useState } from 'react'
import { IconTrash } from '@tabler/icons-react'

import { RupeeField } from '@/components/rupee-field'
import { PercentField } from '@/components/setup/assumptions-section'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { addMonths, currentMonth, formatMonthLabel, monthsBetween } from '@/lib/domain/month'
import { INFLATION_CLASSES, inflateOver, inflationClass } from '@/lib/domain/rates'
import { formatINR, toPaise } from '@/lib/domain/money'
import { monthlyEMI } from '@/lib/domain/loan'
import type { Goal, GoalFunding, ISOMonth, Paise } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

const EMOJI = ['🎓', '🚗', '✈️', '🏠', '🛍️', '💍', '💻', '🎯']

export type GoalDraft = {
  id?: string
  name: string
  emoji: string
  targetAmount: Paise
  targetMonth: ISOMonth
  funding: GoalFunding
  downPayment: Paise
  annualRatePct: number
  tenureMonths: number
  amountIn: 'today' | 'future'
  inflationClass: string
}

export function emptyDraft(): GoalDraft {
  return {
    name: '',
    emoji: '🎯',
    targetAmount: toPaise(100_000),
    targetMonth: addMonths(currentMonth(), 12),
    funding: 'savings',
    downPayment: 0,
    annualRatePct: 9,
    tenureMonths: 60,
    amountIn: 'today',
    inflationClass: 'none',
  }
}

export function draftFromGoal(goal: Goal): GoalDraft {
  return {
    id: goal.id,
    name: goal.name,
    emoji: goal.emoji ?? '🎯',
    targetAmount: goal.targetAmount,
    targetMonth: goal.targetMonth,
    funding: goal.funding,
    downPayment: goal.downPayment ?? 0,
    annualRatePct: goal.loanTerms?.annualRatePct ?? 9,
    tenureMonths: goal.loanTerms?.tenureMonths ?? 60,
    amountIn: goal.amountIn ?? 'today',
    inflationClass: goal.inflationClass ?? 'none',
  }
}

export function GoalDrawer({
  draft,
  onClose,
  onSave,
  onDelete,
}: {
  draft: GoalDraft | null
  onClose: () => void
  onSave: (draft: GoalDraft) => void
  onDelete?: (id: string) => void
}) {
  if (!draft) return <Drawer open={false} onOpenChange={onClose} />
  // Remounting per draft keeps the form's state in step with the goal being
  // edited, without an effect that mirrors a prop into state.
  return (
    <GoalForm
      key={draft.id ?? 'new'}
      draft={draft}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
    />
  )
}

function GoalForm({
  draft,
  onClose,
  onSave,
  onDelete,
}: {
  draft: GoalDraft
  onClose: () => void
  onSave: (draft: GoalDraft) => void
  onDelete?: (id: string) => void
}) {
  const [local, setLocal] = useState<GoalDraft>(draft)

  const loanFunded = local.funding !== 'savings'
  const inflated =
    local.amountIn === 'future'
      ? local.targetAmount
      : inflateOver(
          local.targetAmount,
          inflationClass(local.inflationClass).ratePct,
          monthsBetween(currentMonth(), local.targetMonth),
        )
  const borrowed = Math.max(0, local.targetAmount - local.downPayment)
  const emi = loanFunded ? monthlyEMI(borrowed, local.annualRatePct, local.tenureMonths) : 0

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{local.id ? 'Edit goal' : 'New goal'}</DrawerTitle>
          <DrawerDescription>
            What you want, and when you want it by.
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-6 overflow-y-auto px-4">
          <div className="flex gap-2">
            {EMOJI.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setLocal({ ...local, emoji })}
                className={cn(
                  'size-9 rounded-lg text-lg transition-colors',
                  local.emoji === emoji ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted',
                )}
              >
                {emoji}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="label-xs">Name</span>
            <input
              autoFocus={!local.id}
              value={local.name}
              placeholder="Master's degree"
              onChange={(e) => setLocal({ ...local, name: e.target.value })}
              className="mt-1.5 w-full border-b-2 bg-transparent pb-1 text-lg outline-none focus:border-primary placeholder:text-muted-foreground/50"
            />
          </label>

          <RupeeField
            label="How much"
            value={local.targetAmount}
            onChange={(targetAmount) => setLocal({ ...local, targetAmount })}
          />

          {/* A price in today's money is not what it will cost by then. */}
          <div>
            <p className="label-xs">That figure is</p>
            <div className="mt-2 flex rounded-lg bg-muted p-0.5">
              {(
                [
                  { key: 'today', label: "Today's price" },
                  { key: 'future', label: 'The price then' },
                ] as const
              ).map((option) => (
                <button
                  key={option.key}
                  onClick={() => setLocal({ ...local, amountIn: option.key })}
                  className={cn(
                    'flex-1 rounded-md px-3 py-2.5 text-xs font-medium transition-colors',
                    local.amountIn === option.key ? 'bg-card shadow-sm' : 'text-muted-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {local.amountIn === 'today' && (
              <>
                <select
                  value={local.inflationClass}
                  aria-label="How this goal's price rises"
                  onChange={(e) => setLocal({ ...local, inflationClass: e.target.value })}
                  className="mt-2 w-full rounded-lg border bg-background px-2 py-1.5 text-xs text-muted-foreground outline-none"
                >
                  {INFLATION_CLASSES.map((preset) => (
                    <option key={preset.key} value={preset.key}>
                      Rises like {preset.label.toLowerCase()}
                      {preset.ratePct > 0 ? ` · ${preset.ratePct}%` : ''}
                    </option>
                  ))}
                </select>
                {inflated !== local.targetAmount && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    About <span className="tnum text-foreground">{formatINR(inflated)}</span> by{' '}
                    {formatMonthLabel(local.targetMonth)} — that is what the app will plan for.
                  </p>
                )}
              </>
            )}
          </div>

          <label className="block">
            <span className="label-xs">Wanted by</span>
            <input
              type="month"
              value={local.targetMonth}
              onChange={(e) => setLocal({ ...local, targetMonth: e.target.value })}
              className="mt-1.5 w-full border-b-2 bg-transparent pb-1 num-md outline-none focus:border-primary"
            />
          </label>

          <div>
            <p className="label-xs">Paying for it</p>
            <div className="mt-2 flex rounded-lg bg-muted p-0.5">
              {(
                [
                  { key: 'savings', label: 'From savings' },
                  { key: 'loan', label: 'With a loan' },
                ] as const
              ).map((option) => (
                <button
                  key={option.key}
                  onClick={() => setLocal({ ...local, funding: option.key })}
                  className={cn(
                    'flex-1 rounded-md px-3 py-2.5 text-xs font-medium transition-colors',
                    local.funding === option.key ? 'bg-card shadow-sm' : 'text-muted-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {loanFunded && (
            <div className="space-y-5 rounded-xl border bg-background p-4">
              <RupeeField
                label="Paid up front"
                hint="The only cash this goal takes from your savings."
                value={local.downPayment}
                onChange={(downPayment) => setLocal({ ...local, downPayment })}
              />
              <div className="grid grid-cols-2 gap-4">
                <PercentField
                  label="Interest"
                  value={local.annualRatePct}
                  onChange={(annualRatePct) => setLocal({ ...local, annualRatePct })}
                />
                <PercentField
                  label="Over"
                  unit="months"
                  value={local.tenureMonths}
                  onChange={(tenureMonths) => setLocal({ ...local, tenureMonths })}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Borrowing <span className="tnum text-foreground">{formatINR(borrowed)}</span> —
                that is <span className="tnum text-foreground">{formatINR(emi)}</span> a month
                for {local.tenureMonths} months.
              </p>
            </div>
          )}
        </div>

        <DrawerFooter className="gap-2">
          <Button
            size="lg"
            disabled={!local.name.trim() || local.targetAmount <= 0}
            onClick={() => onSave(local)}
          >
            {local.id ? 'Save goal' : 'Add goal'}
          </Button>
          {local.id && onDelete && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(local.id as string)}
            >
              <IconTrash className="size-4" />
              Delete goal
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
