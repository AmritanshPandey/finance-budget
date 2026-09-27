'use client'

import { useSyncExternalStore } from 'react'

import { CATEGORY_COLORS, type CategoryColor } from '@/lib/domain/look'

/**
 * ECharts draws to canvas, so it cannot resolve `var(--cat-teal)`. The tokens
 * have to be read out of the document as real colours first.
 */
export type ResolvedPalette = Record<string, string> & { on: string; muted: string; text: string }

let cache: ResolvedPalette | null = null

function read(): ResolvedPalette {
  if (cache) return cache
  const styles = getComputedStyle(document.documentElement)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  const resolve = (value: string) => {
    if (!ctx) return value
    ctx.fillStyle = '#000'
    ctx.fillStyle = value.trim()
    return ctx.fillStyle
  }

  const palette = {} as ResolvedPalette
  for (const name of CATEGORY_COLORS) {
    palette[name] = resolve(styles.getPropertyValue(`--cat-${name}`))
  }
  palette.on = resolve(styles.getPropertyValue('--on-cat'))
  palette.muted = resolve(styles.getPropertyValue('--muted-foreground'))
  palette.text = resolve(styles.getPropertyValue('--foreground'))
  cache = palette
  return palette
}

const EMPTY: ResolvedPalette = {
  ...Object.fromEntries(CATEGORY_COLORS.map((c) => [c, '#888'])),
  on: '#111',
  muted: '#888',
  text: '#eee',
} as ResolvedPalette

/** Stable across renders; the theme is fixed so one read is enough. */
export function useResolvedPalette(): ResolvedPalette {
  return useSyncExternalStore(
    () => () => {},
    read,
    () => EMPTY,
  )
}

export function colourOf(palette: ResolvedPalette, color: CategoryColor | string | undefined): string {
  return palette[color ?? 'slate'] ?? palette.slate
}
