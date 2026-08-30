'use client'

import { useState } from 'react'
import { Archive, Plus, Undo2 } from 'lucide-react'

import { Section } from '@/components/setup/section'
import { Button } from '@/components/ui/button'
import {
  addGroup,
  archiveCategory,
  moveCategoryToGroup,
  renameCategory,
  renameGroup,
  restoreCategory,
} from '@/lib/domain/mutations'
import { useBudget } from '@/lib/state/store'
import type { BudgetDoc, Category } from '@/lib/domain/types'

export function CategoriesSection({ doc }: { doc: BudgetDoc }) {
  const apply = useBudget((s) => s.apply)
  const [newGroup, setNewGroup] = useState('')

  const groups = [...doc.groups].sort((a, b) => a.order - b.order)
  const archived = doc.categories.filter((c) => c.archivedAt)

  return (
    <Section
      title="Categories"
      caption="Rename anything, move it anywhere. Past months keep the old names."
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
            <Plus className="size-4" />
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
                    <Undo2 className="size-3.5" />
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

  return (
    <li className="flex items-center gap-1.5">
      <input
        value={category.name}
        onChange={(e) => apply((d) => renameCategory(d, category.id, e.target.value))}
        aria-label={`Rename ${category.name}`}
        className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-sm outline-none focus:bg-accent/70"
      />
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
      <button
        onClick={() =>
          apply((d) => archiveCategory(d, category.id, new Date().toISOString().slice(0, 10)))
        }
        aria-label={`Archive ${category.name}`}
        className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Archive className="size-3.5" />
      </button>
    </li>
  )
}
