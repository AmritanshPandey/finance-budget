import type { CategoryColor } from '@/lib/domain/look'

/** The CSS custom property backing a category colour. */
export function catVar(color: CategoryColor | string | undefined): string {
  return `var(--cat-${color ?? 'slate'})`
}

/**
 * Inline style that makes `cat-tint`, `bg-[var(--cat)]` and friends resolve to
 * this category's colour. One variable, set on the element.
 */
export function catStyle(color: CategoryColor | string | undefined): React.CSSProperties {
  return { ['--cat' as string]: catVar(color) }
}
