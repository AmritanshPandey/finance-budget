'use client'

import { useState } from 'react'

import { parseAmount, toEditableString } from '@/lib/domain/money'
import type { Paise } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

/** A labelled rupee input. Accepts "20k" and "1.5L" like everywhere else. */
export function RupeeField({
  label,
  onRenameLabel,
  hint,
  value,
  onChange,
  autoFocus,
  placeholder = '0',
  className,
}: {
  label: string
  /** When given, the label itself is editable. */
  onRenameLabel?: (next: string) => void
  hint?: string
  value: Paise
  onChange: (next: Paise) => void
  autoFocus?: boolean
  placeholder?: string
  className?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState<string | null>(null)

  return (
    <label className={cn('block', className)}>
      {onRenameLabel ? (
        <input
          value={nameDraft ?? label}
          aria-label={`Rename ${label}`}
          onFocus={() => setNameDraft(label)}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => {
            const next = nameDraft?.trim()
            setNameDraft(null)
            if (next && next !== label) onRenameLabel(next)
          }}
          className="label-xs w-full rounded-md bg-transparent outline-none focus:bg-accent/70 focus:ring-2 focus:ring-ring/40"
        />
      ) : (
        <span className="label-xs">{label}</span>
      )}
      <div className="mt-1.5 flex items-baseline gap-1 border-b-2 pb-1 focus-within:border-primary">
        <span className="text-xl text-muted-foreground">₹</span>
        <input
          autoFocus={autoFocus}
          inputMode="decimal"
          placeholder={placeholder}
          value={draft ?? (value ? toEditableString(value) : '')}
          onChange={(e) => {
            setDraft(e.target.value)
            const parsed = parseAmount(e.target.value)
            if (parsed !== null) onChange(parsed)
          }}
          onBlur={() => setDraft(null)}
          className="w-full bg-transparent num-lg outline-none placeholder:text-muted-foreground/50"
        />
      </div>
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}
