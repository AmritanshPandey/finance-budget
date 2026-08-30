'use client'

import { useRef, useState } from 'react'

import { formatINR, parseAmount, toEditableString } from '@/lib/domain/money'
import type { Paise } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

/**
 * Fast entry: shows the formatted figure at rest, a bare number while editing,
 * and accepts the shorthands people actually type ("20k", "1.5L").
 */
export function AmountInput({
  value,
  onCommit,
  disabled,
  className,
  ariaLabel,
}: {
  value: Paise
  onCommit: (next: Paise) => void
  disabled?: boolean
  className?: string
  ariaLabel: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function commit() {
    if (draft === null) return
    const parsed = parseAmount(draft)
    setDraft(null)
    if (parsed !== null && parsed !== value) onCommit(parsed)
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      enterKeyHint="done"
      disabled={disabled}
      aria-label={ariaLabel}
      value={draft ?? formatINR(value)}
      onFocus={() => {
        setDraft(toEditableString(value))
        requestAnimationFrame(() => inputRef.current?.select())
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          inputRef.current?.blur()
        }
        if (e.key === 'Escape') {
          setDraft(null)
          inputRef.current?.blur()
        }
      }}
      className={cn(
        'w-32 rounded-md bg-transparent px-2 py-1.5 text-right num-md',
        'outline-none transition-colors',
        'focus:bg-accent/70 focus:ring-2 focus:ring-ring/40',
        disabled && 'text-muted-foreground',
        className,
      )}
    />
  )
}
