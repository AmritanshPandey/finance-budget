'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { CategoryIcon } from '@/components/category-icon'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { suggestCategory } from '@/lib/domain/actuals'
import { formatINR, parseAmount, toEditableString } from '@/lib/domain/money'
import { addTransaction } from '@/lib/domain/mutations'
import { useBudget } from '@/lib/state/store'
import { cn } from '@/lib/utils'
import type { Paise } from '@/lib/domain/types'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function QuickAddDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const doc = useBudget((s) => s.doc)
  const apply = useBudget((s) => s.apply)

  const [amount, setAmount] = useState<Paise>(0)
  const [draft, setDraft] = useState('')
  const [merchant, setMerchant] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [date, setDate] = useState(today())
  const [direction, setDirection] = useState<'in' | 'out'>('out')
  /** Once the user picks a category by hand, stop second-guessing them. */
  const [pinned, setPinned] = useState(false)

  const categories = useMemo(
    () =>
      (doc?.categories ?? [])
        .filter((c) => !c.archivedAt && (direction === 'in' ? c.kind === 'income' : c.kind !== 'income'))
        .sort((a, b) => a.order - b.order),
    [doc, direction],
  )

  if (!doc) return null

  function onMerchantChange(value: string) {
    setMerchant(value)
    if (pinned || !doc) return
    const guess = suggestCategory(doc, value)
    if (guess) setCategoryId(guess)
  }

  function reset() {
    setAmount(0)
    setDraft('')
    setMerchant('')
    setCategoryId(null)
    setDate(today())
    setDirection('out')
    setPinned(false)
  }

  function save() {
    if (amount <= 0 || !categoryId) return
    apply((d) =>
      addTransaction(d, {
        date,
        amount,
        direction,
        categoryId,
        merchant: merchant.trim() || undefined,
      }),
    )
    const name = doc?.categories.find((c) => c.id === categoryId)?.name
    toast(`${formatINR(amount)} logged to ${name}`)
    reset()
    onOpenChange(false)
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Log spending</DrawerTitle>
          <DrawerDescription>Amount, where, and what it was for.</DrawerDescription>
        </DrawerHeader>

        <div className="space-y-6 overflow-y-auto px-4">
          <div className="flex rounded-xl bg-muted p-0.5">
            {(
              [
                { key: 'out', label: 'Money out' },
                { key: 'in', label: 'Money in' },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                onClick={() => {
                  setDirection(option.key)
                  setCategoryId(null)
                  setPinned(false)
                }}
                className={cn(
                  'flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  direction === option.key ? 'bg-card shadow-sm' : 'text-muted-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="label-xs">Amount</span>
            <div className="mt-1 flex items-baseline gap-2 border-b-2 pb-1 focus-within:border-primary">
              <span className="num-lg text-muted-foreground">₹</span>
              <input
                autoFocus
                inputMode="decimal"
                placeholder="0"
                value={draft || (amount ? toEditableString(amount) : '')}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setAmount(parseAmount(e.target.value) ?? 0)
                }}
                className="w-full bg-transparent num-hero outline-none placeholder:text-muted-foreground/40"
              />
            </div>
          </label>

          <label className="block">
            <span className="label-xs">Where</span>
            <input
              value={merchant}
              placeholder="Blinkit"
              onChange={(e) => onMerchantChange(e.target.value)}
              className="mt-1.5 w-full border-b-2 bg-transparent pb-1 text-base outline-none focus:border-primary placeholder:text-muted-foreground/40"
            />
            <span className="mt-1.5 block text-xs text-muted-foreground">
              {merchant.trim()
                ? 'Remembered next time you type it.'
                : 'Optional — but it teaches the app your shops.'}
            </span>
          </label>

          <div>
            <p className="label-xs">What for</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {categories.map((category) => {
                const selected = category.id === categoryId
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      setCategoryId(category.id)
                      setPinned(true)
                    }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-medium transition-colors',
                      selected
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <CategoryIcon
                      name={category.name}
                      icon={category.icon}
                      color={category.color}
                      size="sm"
                    />
                    {category.name}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="block">
            <span className="label-xs">When</span>
            <input
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full border-b-2 bg-transparent pb-1 num-md outline-none focus:border-primary"
            />
          </label>
        </div>

        <DrawerFooter>
          <Button size="lg" disabled={amount <= 0 || !categoryId} onClick={save}>
            Log {amount > 0 ? formatINR(amount) : 'it'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
