'use client'

import { useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'

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
  defaultOpen = true,
  muted,
}: {
  name: string
  subtotal: Paise
  children: React.ReactNode
  onAdd?: () => void
  defaultOpen?: boolean
  muted?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left"
        >
          <ChevronRight
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-90',
            )}
            strokeWidth={2.2}
          />
          <span
            className={cn(
              'flex-1 text-sm font-semibold tracking-tight',
              muted && 'text-muted-foreground',
            )}
          >
            {name}
          </span>
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
            <Plus className="size-4" strokeWidth={2.2} />
          </button>
        )}
      </div>

      {open && <div className="border-t px-2 py-1.5">{children}</div>}
    </section>
  )
}
