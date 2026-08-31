'use client'

import { useState } from 'react'
import { IconArchive, IconArrowBackUp, IconLock, IconLockOpen, IconPlus } from '@tabler/icons-react'

import { Section } from '@/components/setup/section'
import { Button } from '@/components/ui/button'
import {
  addGroup,
  archiveCategory,
  moveCategoryToGroup,
  renameCategory,
  renameGroup,
  lineForCategory,
  restoreCategory,
  setCategoryDueDay,
  setCategoryKind,
  setCategoryLocked,
  setLinePlan,
} from '@/lib/domain/mutations'
import { PlanControl } from '@/components/plan-control'
import { planFromVersions } from '@/lib/domain/plan'
import { useBudget } from '@/lib/state/store'
import type { BudgetDoc, Category, LineKind } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

export function CategoriesSection({ doc }: { doc: BudgetDoc }) {
  const apply = useBudget((s) => s.apply)
  const [newGroup, setNewGroup] = useState('')

  const groups = [...doc.groups].sort((a, b) => a.order - b.order)
  const archived = doc.categories.filter((c) => c.archivedAt)

  return (
    <Section
      title="Categories"
      caption="Rename anything, move it anywhere, mark it as investing. Past months keep the old names."
    >
      <div className="space-y-5">
        {groups.map((group) => {
          const members = doc.categories
            .filter((c) => c.groupId === group.id && !c.archivedAt)
            .sort((a, b) => a.order - b.order)

          return (
            <div key={group.id}>
              <input
                value={group.name}
                onChange={(e) => apply((d) => renameGroup(d, group.id, e.target.value))}
                aria-label={`Rename group ${group.name}`}
                className="w-full rounded-md bg-transparent px-1 py-1 text-sm font-semibold outline-none focus:bg-accent/70"
              />
              <ul className="mt-1 space-y-1">
                {members.map((category) => (
                  <CategoryRow key={category.id} doc={doc} category={category} />
                ))}
                {members.length === 0 && (
                  <li className="px-1 py-1 text-xs text-muted-foreground">Empty</li>
                )}
              </ul>
            </div>
          )
        })}

        <div className="flex gap-2 border-t pt-4">
          <input
            value={newGroup}
            placeholder="New group"
            onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newGroup.trim()) {
                apply((d) => addGroup(d, newGroup.trim()))
                setNewGroup('')
              }
            }}
            className="min-w-0 flex-1 rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!newGroup.trim()}
            onClick={() => {
              apply((d) => addGroup(d, newGroup.trim()))
              setNewGroup('')
            }}
          >
            <IconPlus className="size-4" />
            Group
          </Button>
        </div>

        {archived.length > 0 && (
          <div className="border-t pt-4">
            <p className="label-xs">Archived</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Hidden from new months. Still shown in the months they belonged to.
            </p>
            <ul className="mt-2 space-y-1">
              {archived.map((category) => (
                <li key={category.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {category.name}
                  </span>
                  <button
                    onClick={() => apply((d) => restoreCategory(d, category.id))}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <IconArrowBackUp className="size-3.5" />
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  )
}

function CategoryRow({ doc, category }: { doc: BudgetDoc; category: Category }) {
  const apply = useBudget((s) => s.apply)
  const groups = [...doc.groups].sort((a, b) => a.order - b.order)
  const investing = category.kind === 'investment'
  const line = lineForCategory(doc, category.id)
  const plan = line ? planFromVersions(line.versions) : null

  return (
    <li className="rounded-lg border border-transparent px-0.5 py-1 hover:border-border">
      <div className="flex items-center gap-1.5">
        <input
          value={category.name}
          onChange={(e) => apply((d) => renameCategory(d, category.id, e.target.value))}
          aria-label={`Rename ${category.name}`}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-sm outline-none focus:bg-accent/70"
        />
        <button
          onClick={() =>
            apply((d) => archiveCategory(d, category.id, new Date().toISOString().slice(0, 10)))
          }
          aria-label={`Archive ${category.name}`}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <IconArchive className="size-3.5" />
        </button>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-1">
        {category.kind !== 'income' && (
          <>
            <select
              value={category.groupId}
              aria-label={`Move ${category.name} to another group`}
              onChange={(e) => apply((d) => moveCategoryToGroup(d, category.id, e.target.value))}
              className="rounded-md border bg-background px-1.5 py-1 text-xs text-muted-foreground outline-none"
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>

            {/* Investing is not spending: the money leaves your account but stays yours. */}
            <select
              value={category.kind}
              aria-label={`Is ${category.name} spending or investing?`}
              onChange={(e) =>
                apply((d) => setCategoryKind(d, category.id, e.target.value as LineKind))
              }
              className="rounded-md border bg-background px-1.5 py-1 text-xs text-muted-foreground outline-none"
            >
              <option value="expense">Spending</option>
              <option value="investment">Investing</option>
            </select>
          </>
        )}

        {/* A due day is what puts a bill on the overview. */}
        {category.kind === 'expense' && (
          <label className="flex items-center gap-1 rounded-md border bg-background px-1.5 py-1 text-xs text-muted-foreground">
            due
            <input
              inputMode="numeric"
              placeholder="—"
              aria-label={`Day of the month ${category.name} falls due`}
              value={category.dueDay ?? ''}
              onChange={(e) => {
                const raw = e.target.value.trim()
                if (raw === '') return apply((d) => setCategoryDueDay(d, category.id, undefined))
                const day = Number(raw)
                if (!Number.isInteger(day) || day < 1 || day > 31) return
                apply((d) => setCategoryDueDay(d, category.id, day))
              }}
              className="w-6 bg-transparent text-center tnum outline-none placeholder:text-muted-foreground/50"
            />
          </label>
        )}

        {investing && (
          <button
            onClick={() => apply((d) => setCategoryLocked(d, category.id, !category.locked))}
            aria-pressed={Boolean(category.locked)}
            className={cn(
              'flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs transition-colors',
              category.locked
                ? 'border-warn/40 bg-warn-soft text-warn'
                : 'bg-background text-muted-foreground hover:bg-accent',
            )}
          >
            {category.locked ? <IconLock className="size-3" /> : <IconLockOpen className="size-3" />}
            {category.locked ? 'Locked away' : 'Goals can use it'}
          </button>
        )}
      </div>

      {/* The whole life of the line, editable here as well as on Budget. */}
      {line && plan && (
        <div className="mt-1.5 pl-1">
          <PlanControl
            compact
            plan={plan}
            onChange={(next) => apply((d) => setLinePlan(d, line.id, next, category.name))}
            horizonMonths={doc.settings.horizonMonths}
          />
        </div>
      )}
    </li>
  )
}
