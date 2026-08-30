'use client'

import { useRef, useState } from 'react'
import { Check, X } from 'lucide-react'

import { parseAmount } from '@/lib/domain/money'
import type { Paise } from '@/lib/domain/types'

/** Inline, never a modal — typing a name is how a category gets created. */
export function NewLineRow({
  onAdd,
  onCancel,
}: {
  onAdd: (name: string, amount: Paise) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return onCancel()
    onAdd(trimmed, parseAmount(amount) ?? 0)
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-accent/50 py-0.5 pl-1 pr-1">
      <input
        ref={nameRef}
        autoFocus
        value={name}
        placeholder="New line"
        aria-label="New line name"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') onCancel()
        }}
        className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/70"
      />
      <input
        value={amount}
        inputMode="decimal"
        placeholder="0"
        aria-label="New line amount"
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') onCancel()
        }}
        className="w-24 rounded-md bg-transparent px-2 py-1.5 text-right num-md outline-none placeholder:text-muted-foreground/70"
      />
      <button
        onClick={submit}
        aria-label="Add line"
        className="rounded-md p-1.5 text-primary transition-colors hover:bg-primary/10"
      >
        <Check className="size-4" strokeWidth={2.4} />
      </button>
      <button
        onClick={onCancel}
        aria-label="Cancel"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent"
      >
        <X className="size-4" strokeWidth={2.4} />
      </button>
    </div>
  )
}
