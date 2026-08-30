'use client'

import { inferLook, isIconKey, type CategoryColor, type IconKey } from '@/lib/domain/look'
import { CATEGORY_ICONS } from '@/lib/ui/category-icons'
import { catStyle } from '@/lib/ui/palette'
import { cn } from '@/lib/utils'

const SIZES = {
  sm: { box: 'size-7 rounded-lg', icon: 15 },
  md: { box: 'size-9 rounded-xl', icon: 19 },
  lg: { box: 'size-11 rounded-2xl', icon: 23 },
} as const

/**
 * The tinted circle used on every line, chip and tile. Given only a name it
 * infers its own look, so a freshly typed category is dressed immediately.
 */
export function CategoryIcon({
  name,
  icon,
  color,
  size = 'md',
  className,
}: {
  name?: string
  icon?: string
  color?: CategoryColor | string
  size?: keyof typeof SIZES
  className?: string
}) {
  const fallback = name ? inferLook(name) : { icon: 'tag' as IconKey, color: 'slate' }
  const key = icon && isIconKey(icon) ? icon : fallback.icon
  const tone = color ?? fallback.color
  const Glyph = CATEGORY_ICONS[key]
  const { box, icon: iconSize } = SIZES[size]

  return (
    <span
      style={catStyle(tone)}
      className={cn('cat-tint flex shrink-0 items-center justify-center', box, className)}
      aria-hidden
    >
      <Glyph size={iconSize} stroke={2} />
    </span>
  )
}
