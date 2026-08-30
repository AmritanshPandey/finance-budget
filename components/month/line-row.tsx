'use client'

import { useRef, useState } from 'react'
import { Lock, RotateCcw } from 'lucide-react'

import { AmountInput } from '@/components/amount-input'
import { formatMonthLabel } from '@/lib/domain/month'
import type { Paise, ResolvedLine } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

export function LineRow({
  line,
  frozen,
  onAmountChange,
  onRename,
  onClearOverride,
}: {
  line: ResolvedLine
  frozen: boolean
  onAmountChange: (amount: Paise) => void
  onRename: (name: string) => void
  onClearOverride: () => void
}) {
  const derived = Boolean(line.loanId)
  const editable = !frozen && !derived

  return (
    <div className="flex items-center gap-2 py-0.5 pl-1">
      <div className="min-w-0 flex-1">
        <NameField
          name={line.categoryName}
          editable={editable}
          onRename={onRename}
        />
        {derived && line.endsMonth && (
          <p className="flex items-center gap-1 pl-2 text-xs text-muted-foreground">
            <Lock className="size-3" strokeWidth={2} />
            ends {formatMonthLabel(line.endsMonth)}
          </p>
        )}
        {line.overridden && !frozen && (
          <button
            onClick={onClearOverride}
            className="flex items-center gap-1 pl-2 text-xs text-warn hover:underline"
          >
            <RotateCcw className="size-3" strokeWidth={2} />
            just this month · undo
          </button>
        )}
      </div>

      <AmountInput
        value={line.amount}
        onCommit={onAmountChange}
        disabled={!editable}
        ariaLabel={`${line.categoryName} amount`}
        className={cn(line.overridden && 'text-warn')}
      />
    </div>
  )
}

/** Renaming is a tap on the name — the same gesture as changing the number. */
function NameField({
  name,
  editable,
  onRename,
}: {
  name: string
  editable: boolean
  onRename: (name: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  if (!editable) {
    return <p className="truncate px-2 py-1.5 text-sm">{name}</p>
  }

  return (
    <input
      ref={ref}
      type="text"
      aria-label={`Rename ${name}`}
      value={draft ?? name}
      onFocus={() => setDraft(name)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft?.trim()
        setDraft(null)
        if (next && next !== name) onRename(next)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') ref.current?.blur()
        if (e.key === 'Escape') {
          setDraft(null)
          ref.current?.blur()
        }
      }}
      className="w-full truncate rounded-md bg-transparent px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent/70 focus:ring-2 focus:ring-ring/40"
    />
  )
}
