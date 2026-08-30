'use client'

import { CalendarRange, CalendarClock } from 'lucide-react'

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { formatMonthLabel } from '@/lib/domain/month'
import { formatINR } from '@/lib/domain/money'
import type { EditScope } from '@/lib/domain/mutations'
import type { ISOMonth, Paise } from '@/lib/domain/types'

export interface PendingEdit {
  lineId: string
  name: string
  amount: Paise
  previous: Paise
  month: ISOMonth
}

/**
 * The recurring-calendar-event question, asked only when it matters: editing a
 * month that has not happened yet.
 */
export function EditScopeDrawer({
  edit,
  onResolve,
  onCancel,
}: {
  edit: PendingEdit | null
  onResolve: (scope: EditScope) => void
  onCancel: () => void
}) {
  return (
    <Drawer open={Boolean(edit)} onOpenChange={(open) => !open && onCancel()}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>
            {edit?.name} · {formatINR(edit?.amount ?? 0)}
          </DrawerTitle>
          <DrawerDescription>
            Was {formatINR(edit?.previous ?? 0)}. Should this stick?
          </DrawerDescription>
        </DrawerHeader>

        <DrawerFooter className="gap-2">
          <ScopeButton
            icon={<CalendarClock className="size-5" strokeWidth={2} />}
            title={`Just ${edit ? formatMonthLabel(edit.month) : 'this month'}`}
            detail="A one-off. Every other month keeps its plan."
            onClick={() => onResolve('month')}
          />
          <ScopeButton
            icon={<CalendarRange className="size-5" strokeWidth={2} />}
            title="This month and all future"
            detail="A real change — it carries forward from here."
            onClick={() => onResolve('future')}
            primary
          />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function ScopeButton({
  icon,
  title,
  detail,
  onClick,
  primary,
}: {
  icon: React.ReactNode
  title: string
  detail: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={
        primary
          ? 'flex w-full items-center gap-3 rounded-xl bg-primary px-4 py-3 text-left text-primary-foreground transition-opacity hover:opacity-90'
          : 'flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-accent'
      }
    >
      <span className={primary ? 'opacity-90' : 'text-muted-foreground'}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className={primary ? 'block text-xs opacity-80' : 'block text-xs text-muted-foreground'}>
          {detail}
        </span>
      </span>
    </button>
  )
}
