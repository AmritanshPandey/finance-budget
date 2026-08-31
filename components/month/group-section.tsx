'use client'

import { useRef, useState } from 'react'
import { IconChevronRight, IconPlus } from '@tabler/icons-react'

import { formatINR } from '@/lib/domain/money'
import type { Paise } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

/**
 * A collapsible group with its subtotal in the header — the hierarchy that
 * makes twenty lines scannable on a phone.
 */
export function GroupSection({
  name,
  subtotal,
  children,
  onAdd,
  onRename,
  defaultOpen = true,
  muted,
}: {
  name: string
  onRename?: (next: string) => void
  subtotal: Paise
  children: React.ReactNode
  onAdd?: () => void
  defaultOpen?: boolean
  muted?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="rounded-3xl border bg-card">
      <div className="flex items-center">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? `Collapse ${name}` : `Expand ${name}`}
          className="rounded-3xl py-3 pl-4 pr-1"
        >
          <IconChevronRight
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-90',
            )}
            stroke={2.2}
          />
        </button>

        {onRename ? (
          <GroupName name={name} muted={muted} onRename={onRename} />
        ) : (
          <span
            className={cn(
              'flex-1 py-3 text-sm font-semibold tracking-tight',
              muted && 'text-muted-foreground',
            )}
          >
            {name}
          </span>
        )}

        <button
          onClick={() => setOpen((o) => !o)}
          tabIndex={-1}
          aria-hidden
          className="py-3 pr-1"
        >
          <span className={cn('num-md', muted && 'text-muted-foreground')}>
            {formatINR(subtotal)}
          </span>
        </button>
        {onAdd && (
          <button
            onClick={onAdd}
            aria-label={`Add a line to ${name}`}
            className="mr-2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <IconPlus className="size-4" stroke={2.2} />
          </button>
        )}
      </div>

      {open && <div className="border-t px-3 py-1.5">{children}</div>}
    </section>
  )
}

/** The group heading, renameable in place. */
function GroupName({
  name,
  muted,
  onRename,
}: {
  name: string
  muted?: boolean
  onRename: (next: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  return (
    <input
      ref={ref}
      value={draft ?? name}
      aria-label={`Rename ${name}`}
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
      className={cn(
        'min-w-0 flex-1 rounded-md bg-transparent py-3 text-sm font-semibold tracking-tight',
        'outline-none transition-colors focus:bg-accent/70 focus:ring-2 focus:ring-ring/40',
        muted && 'text-muted-foreground',
      )}
    />
  )
}
