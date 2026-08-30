'use client'

import { useMemo } from 'react'

import { LOANS_GROUP_ID, LOANS_GROUP_NAME } from '@/lib/domain/constants'
import { resolveMonth } from '@/lib/domain/resolve-month'
import type {
  BudgetDoc,
  ISOMonth,
  Paise,
  ResolvedLine,
  ResolvedMonth,
} from '@/lib/domain/types'
import { useBudget } from './store'

export interface DisplayGroup {
  id: string
  name: string
  subtotal: Paise
  lines: ResolvedLine[]
  /** The reserved loans group — derived lines, not user-editable. */
  derived?: boolean
}

export interface MonthView {
  resolved: ResolvedMonth
  income: ResolvedLine[]
  incomeTotal: Paise
  expenseGroups: DisplayGroup[]
}

export function buildMonthView(doc: BudgetDoc, month: ISOMonth): MonthView {
  const resolved = resolveMonth(doc, month)

  const income = resolved.lines.filter((l) => l.kind === 'income')
  const expenses = resolved.lines.filter((l) => l.kind === 'expense')

  const groupOrder = new Map(doc.groups.map((g) => [g.id, g.order]))
  const groupNames = new Map(doc.groups.map((g) => [g.id, g.name]))

  const byGroup = new Map<string, ResolvedLine[]>()
  for (const line of expenses) {
    const list = byGroup.get(line.groupId)
    if (list) list.push(line)
    else byGroup.set(line.groupId, [line])
  }

  const expenseGroups: DisplayGroup[] = [...byGroup.entries()]
    .map(([id, lines]) => ({
      id,
      name: id === LOANS_GROUP_ID ? LOANS_GROUP_NAME : (groupNames.get(id) ?? 'Other'),
      subtotal: lines.reduce((acc, l) => acc + l.amount, 0),
      lines,
      derived: id === LOANS_GROUP_ID,
    }))
    .sort((a, b) => {
      // Loans always sit last — they are consequences, not choices.
      if (a.derived) return 1
      if (b.derived) return -1
      return (groupOrder.get(a.id) ?? 99) - (groupOrder.get(b.id) ?? 99)
    })

  return {
    resolved,
    income,
    incomeTotal: income.reduce((acc, l) => acc + l.amount, 0),
    expenseGroups,
  }
}

export function useMonthView(month: ISOMonth): MonthView | null {
  const doc = useBudget((s) => s.doc)
  return useMemo(() => (doc ? buildMonthView(doc, month) : null), [doc, month])
}
