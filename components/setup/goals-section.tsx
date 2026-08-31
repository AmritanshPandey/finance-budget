'use client'

import { useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconGripVertical, IconPlus } from '@tabler/icons-react'

import { Section } from '@/components/setup/section'
import {
  GoalDrawer,
  draftFromGoal,
  emptyDraft,
  type GoalDraft,
} from '@/components/setup/goal-drawer'
import { Button } from '@/components/ui/button'
import { describeOutcome } from '@/lib/domain/goals'
import { formatINR } from '@/lib/domain/money'
import { addGoal, removeGoal, reorderGoals, updateGoal } from '@/lib/domain/mutations'
import { useBudget } from '@/lib/state/store'
import { cn } from '@/lib/utils'
import type { BudgetDoc, Goal, GoalOutcome } from '@/lib/domain/types'

export function GoalsSection({ doc }: { doc: BudgetDoc }) {
  const apply = useBudget((s) => s.apply)
  const outcomes = useBudget((s) => s.projection?.goalOutcomes ?? [])
  const [draft, setDraft] = useState<GoalDraft | null>(null)

  const goals = [...doc.goals]
    .filter((g) => g.status === 'active')
    .sort((a, b) => a.priority - b.priority)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = goals.findIndex((g) => g.id === active.id)
    const newIndex = goals.findIndex((g) => g.id === over.id)
    const ordered = arrayMove(goals, oldIndex, newIndex).map((g) => g.id)
    apply((d) => reorderGoals(d, ordered))
  }

  function save(next: GoalDraft) {
    const patch = {
      name: next.name.trim(),
      emoji: next.emoji,
      targetAmount: next.targetAmount,
      targetMonth: next.targetMonth,
      funding: next.funding,
      amountIn: next.amountIn,
      inflationClass: next.inflationClass,
      downPayment: next.funding === 'savings' ? undefined : next.downPayment,
      loanTerms:
        next.funding === 'savings'
          ? undefined
          : { annualRatePct: next.annualRatePct, tenureMonths: next.tenureMonths },
    }
    apply((d) => (next.id ? updateGoal(d, next.id, patch) : addGoal(d, patch)))
    setDraft(null)
  }

  return (
    <Section
      title="Goals"
      caption="Drag to rank them. The one on top gets the money first."
      action={
        <Button size="sm" variant="outline" onClick={() => setDraft(emptyDraft())}>
          <IconPlus className="size-4" />
          Add
        </Button>
      }
    >
      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No goals yet. Without one, the forecast is just a balance going up.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
          <SortableContext items={goals.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {goals.map((goal, index) => (
                <SortableGoal
                  key={goal.id}
                  goal={goal}
                  rank={index + 1}
                  outcome={outcomes.find((o) => o.goalId === goal.id)}
                  onEdit={() => setDraft(draftFromGoal(goal))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <GoalDrawer
        draft={draft}
        onClose={() => setDraft(null)}
        onSave={save}
        onDelete={(id) => {
          apply((d) => removeGoal(d, id))
          setDraft(null)
        }}
      />
    </Section>
  )
}

function SortableGoal({
  goal,
  rank,
  outcome,
  onEdit,
}: {
  goal: Goal
  rank: number
  outcome?: GoalOutcome
  onEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: goal.id,
  })

  const tone =
    outcome?.status === 'unreachable'
      ? 'text-negative'
      : outcome?.status === 'late'
        ? 'text-warn'
        : 'text-positive'

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-xl border bg-background px-2 py-2',
        isDragging && 'z-10 shadow-lg',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${goal.name}`}
        className="cursor-grab touch-none rounded-md p-1 text-muted-foreground active:cursor-grabbing"
      >
        <IconGripVertical className="size-4" />
      </button>

      <span className="w-4 text-center text-xs font-medium text-muted-foreground">{rank}</span>

      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold">
          {goal.emoji} {goal.name}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          <span className="tnum">{formatINR(goal.targetAmount)}</span>
          {outcome && <> · <span className={tone}>{describeOutcome(outcome)}</span></>}
        </span>
      </button>
    </li>
  )
}
