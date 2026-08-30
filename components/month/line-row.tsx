'use client'

import { useRef, useState } from 'react'
import { IconArrowBackUp, IconLock, IconPigMoney } from '@tabler/icons-react'

import { AmountInput } from '@/components/amount-input'
import { CadenceControl } from '@/components/cadence-control'
import { CategoryIcon } from '@/components/category-icon'
import { formatMonthLabel } from '@/lib/domain/month'
import { catStyle } from '@/lib/ui/palette'
import type { Cadence } from '@/lib/domain/cadence'
import type { ISOMonth, Paise, ResolvedLine } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

export function LineRow({
  line,
  frozen,
  color,
  icon,
  sliderMax,
  cadence,
  startMonth,
  horizonMonths,
  onAmountChange,
  onCadenceChange,
  onRename,
  onClearOverride,
}: {
  line: ResolvedLine
  frozen: boolean
  color?: string
  icon?: string
  sliderMax: Paise
  cadence?: Cadence | null
  startMonth: ISOMonth
  horizonMonths: number
  onCadenceChange: (next: Cadence) => void
  onAmountChange: (amount: Paise) => void
  onRename: (name: string) => void
  onClearOverride: () => void
}) {
  const derived = Boolean(line.loanId)
  // A derived EMI can still be varied for a single month; only its *name*
  // belongs to the loan.
  const editable = !frozen

  return (
    <div className="px-1 py-2.5" style={catStyle(color)}>
      <div className="flex items-center gap-2.5">
        <CategoryIcon name={line.categoryName} icon={icon} color={color} />

        <div className="min-w-0 flex-1">
          <NameField
            name={line.categoryName}
            editable={editable && !derived}
            onRename={onRename}
          />
          {derived && line.endsMonth && (
            <p className="flex items-center gap-1 pl-1 text-xs text-muted-foreground">
              <IconLock size={12} stroke={2} />
              ends {formatMonthLabel(line.endsMonth)}
            </p>
          )}
          {line.kind === 'investment' && (
            <p className="flex items-center gap-1 pl-1 text-xs text-muted-foreground">
              <IconPigMoney size={12} stroke={2} />
              {line.locked ? 'locked away' : 'counts toward goals'}
            </p>
          )}
          {cadence && !frozen && (
            <div className="pl-1 pt-0.5">
              <CadenceControl
                compact
                cadence={cadence}
                onChange={onCadenceChange}
                currentAmount={line.amount}
                startMonth={startMonth}
                horizonMonths={horizonMonths}
              />
            </div>
          )}
          {line.overridden && !frozen && (
            <button
              onClick={onClearOverride}
              className="flex items-center gap-1 pl-1 text-xs text-warn hover:underline"
            >
              <IconArrowBackUp size={12} stroke={2} />
              just this month · undo
            </button>
          )}
        </div>

        <AmountInput
          value={line.amount}
          onCommit={onAmountChange}
          disabled={!editable}
          ariaLabel={`${line.categoryName} amount`}
          className={cn('w-28', line.overridden && 'text-warn')}
        />
      </div>

      {editable && (
        <input
          type="range"
          min={0}
          max={Math.max(sliderMax, line.amount)}
          step={100_00}
          value={line.amount}
          aria-label={`${line.categoryName} slider`}
          onChange={(e) => onAmountChange(Number(e.target.value))}
          className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted [accent-color:var(--cat)]"
          style={{ accentColor: 'var(--cat)' }}
        />
      )}
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
    return <p className="truncate px-1 py-1 text-sm font-medium">{name}</p>
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
      className="w-full truncate rounded-md bg-transparent px-1 py-1 text-sm font-medium outline-none transition-colors focus:bg-accent/70 focus:ring-2 focus:ring-ring/40"
    />
  )
}
