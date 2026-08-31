'use client'

import { Fragment, useMemo, useState } from 'react'
import { IconPlus, IconX } from '@tabler/icons-react'
import { toast } from 'sonner'

import { CategoryIcon } from '@/components/category-icon'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { LOANS_GROUP_ID, LOANS_GROUP_NAME } from '@/lib/domain/constants'
import { applyGrid, buildGrid, derivePeriods, type Grid, type GridPeriod } from '@/lib/domain/grid'
import { addMonths, compareMonth, formatMonthLabel } from '@/lib/domain/month'
import { formatINR, parseAmount, toEditableString } from '@/lib/domain/money'
import { useBudget } from '@/lib/state/store'
import { cn } from '@/lib/utils'
import type { BudgetDoc, ISOMonth } from '@/lib/domain/types'

/**
 * The plan as a grid: lines down, stretches of months across.
 *
 * Columns are the months the plan already changes on, which is how a budget
 * tends to be written down in the first place — "this until December, that
 * until March". Editing a cell sets the line for that whole stretch.
 */
export function BudgetTable({
  doc,
  from,
  open,
  onOpenChange,
}: {
  doc: BudgetDoc
  from: ISOMonth
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const apply = useBudget((s) => s.apply)
  const initial = useMemo(() => buildGrid(doc, derivePeriods(doc, from)), [doc, from])
  const [grid, setGrid] = useState<Grid>(initial)
  const [draft, setDraft] = useState<Record<string, string>>({})

  // Reopening should show what is actually saved, not the last abandoned edit.
  const [seen, setSeen] = useState(initial)
  if (open && seen !== initial) {
    setSeen(initial)
    setGrid(initial)
    setDraft({})
  }

  const groups = useMemo(() => {
    const named = [...doc.groups]
      .sort((a, b) => a.order - b.order)
      .map((group) => ({
        id: group.id,
        name: group.name,
        rows: grid.rows.filter((r) => r.groupId === group.id),
      }))
    const loans = grid.rows.filter((r) => r.groupId === LOANS_GROUP_ID)
    return [...named, { id: LOANS_GROUP_ID, name: LOANS_GROUP_NAME, rows: loans }].filter(
      (g) => g.rows.length > 0,
    )
  }, [doc.groups, grid.rows])

  function setCell(lineId: string, index: number, value: string) {
    setDraft((d) => ({ ...d, [`${lineId}:${index}`]: value }))
    const parsed = parseAmount(value)
    if (parsed === null) return
    setGrid((g) => ({
      ...g,
      rows: g.rows.map((row) =>
        row.lineId === lineId
          ? { ...row, amounts: row.amounts.map((a, i) => (i === index ? parsed : a)) }
          : row,
      ),
    }))
  }

  function addPeriod() {
    const last = grid.periods[grid.periods.length - 1]
    const month = addMonths(last.from, 3)
    const period: GridPeriod = { from: month, label: `${formatMonthLabel(month)} on` }
    const periods = [...grid.periods, period].sort((a, b) => compareMonth(a.from, b.from))
    const at = periods.indexOf(period)
    setGrid((g) => ({
      periods,
      // A new stretch starts as a copy of the one before it.
      rows: g.rows.map((row) => ({
        ...row,
        amounts: [
          ...row.amounts.slice(0, at),
          row.amounts[at - 1] ?? row.amounts[0] ?? 0,
          ...row.amounts.slice(at),
        ],
      })),
    }))
  }

  function setPeriodMonth(index: number, month: ISOMonth) {
    setGrid((g) => ({
      ...g,
      periods: g.periods.map((p, i) =>
        i === index ? { ...p, from: month, label: `${formatMonthLabel(month)} on` } : p,
      ),
    }))
  }

  function removePeriod(index: number) {
    setGrid((g) => ({
      periods: g.periods.filter((_, i) => i !== index),
      rows: g.rows.map((row) => ({
        ...row,
        amounts: row.amounts.filter((_, i) => i !== index),
      })),
    }))
  }

  function save() {
    apply((d) => applyGrid(d, grid))
    toast(`Plan updated across ${grid.periods.length} stretches`)
    onOpenChange(false)
  }

  const columnTotals = grid.periods.map((_, index) =>
    grid.rows.reduce((a, row) => (row.kind === 'income' ? a : a + row.amounts[index]), 0),
  )

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[94dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>The plan as a table</DrawerTitle>
          <DrawerDescription>
            Each column is a stretch of months. Change a figure and it applies to the whole
            stretch.
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-auto px-4">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background pb-2 pr-2 text-left">
                  <span className="label-xs">Line</span>
                </th>
                {grid.periods.map((period, index) => (
                  <th key={period.from} className="min-w-28 pb-2 pl-2 text-left align-bottom">
                    <div className="flex items-center gap-1">
                      <input
                        type="month"
                        value={period.from}
                        aria-label={`Start month of column ${index + 1}`}
                        onChange={(e) => setPeriodMonth(index, e.target.value as ISOMonth)}
                        className="w-full rounded-md bg-transparent py-1 text-xs tnum outline-none focus:bg-accent/70"
                      />
                      {grid.periods.length > 1 && index > 0 && (
                        <button
                          onClick={() => removePeriod(index)}
                          aria-label={`Remove the column starting ${period.label}`}
                          className="-m-1 rounded-md p-2 text-muted-foreground hover:bg-accent"
                        >
                          <IconX size={12} stroke={2.2} />
                        </button>
                      )}
                    </div>
                    <span className="block truncate text-[0.6875rem] text-muted-foreground">
                      {period.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {groups.map(({ id, name, rows }) => (
                <Fragment key={id}>
                  <tr>
                    <td
                      colSpan={grid.periods.length + 1}
                      className="sticky left-0 pb-1 pt-4 text-left"
                    >
                      <span className="label-xs">{name}</span>
                    </td>
                  </tr>
                  {rows.map((row) => (
                    <tr key={row.lineId}>
                      <td className="sticky left-0 z-10 bg-background py-1 pr-2">
                        <div className="flex items-center gap-2">
                          <CategoryIcon
                            name={row.name}
                            icon={row.icon}
                            color={row.color}
                            size="sm"
                          />
                          <span className="max-w-28 truncate text-xs">{row.name}</span>
                        </div>
                      </td>
                      {row.amounts.map((amount, index) => (
                        <td key={index} className="py-1 pl-2">
                          <input
                            inputMode="decimal"
                            readOnly={row.readOnly}
                            aria-label={`${row.name} for ${grid.periods[index].label}`}
                            value={draft[`${row.lineId}:${index}`] ?? toEditableString(amount)}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => setCell(row.lineId, index, e.target.value)}
                            onBlur={() =>
                              setDraft((d) => {
                                const next = { ...d }
                                delete next[`${row.lineId}:${index}`]
                                return next
                              })
                            }
                            className={cn(
                              'w-full rounded-md bg-muted/50 px-2 py-2 text-right num-md outline-none',
                              'focus:bg-accent focus:ring-2 focus:ring-ring/40',
                              amount === 0 && 'text-muted-foreground/50',
                              row.readOnly && 'cursor-not-allowed opacity-60',
                            )}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}

              <tr>
                <td className="sticky left-0 z-10 bg-background pr-2 pt-4">
                  <span className="label-xs">Out</span>
                </td>
                {columnTotals.map((total, index) => (
                  <td key={index} className="pl-2 pt-4 text-right num-md">
                    {/* Exact, not compact — this row is what gets checked
                        against the spreadsheet it came from. */}
                    {formatINR(total)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>

          <button
            onClick={addPeriod}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <IconPlus size={15} stroke={2.2} />
            Add a stretch
          </button>
        </div>

        <DrawerFooter className="gap-2">
          <Button size="lg" onClick={save}>
            Save the table
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
