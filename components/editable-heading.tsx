'use client'

import { useRef, useState } from 'react'

import { labelFor } from '@/lib/domain/labels'
import { setLabel } from '@/lib/domain/mutations'
import { useBudget } from '@/lib/state/store'
import { cn } from '@/lib/utils'

/**
 * A heading you can rename in place. Clearing it restores the default rather
 * than leaving a blank.
 */
export function EditableHeading({
  labelKey,
  as: Tag = 'h2',
  className,
}: {
  labelKey: string
  as?: 'h1' | 'h2' | 'h3'
  className?: string
}) {
  const labels = useBudget((s) => s.doc?.settings.labels)
  const apply = useBudget((s) => s.apply)
  const text = labelFor(labels, labelKey)

  const [draft, setDraft] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  return (
    <Tag className={className}>
      <input
        ref={ref}
        value={draft ?? text}
        aria-label={`Rename “${text}”`}
        onFocus={() => setDraft(text)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const next = draft
          setDraft(null)
          if (next !== null && next !== text) apply((d) => setLabel(d, labelKey, next))
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') ref.current?.blur()
          if (e.key === 'Escape') {
            setDraft(null)
            ref.current?.blur()
          }
        }}
        className={cn(
          'w-full min-w-0 truncate rounded-md bg-transparent outline-none',
          'transition-colors focus:bg-accent/70 focus:ring-2 focus:ring-ring/40',
          className,
        )}
      />
    </Tag>
  )
}
