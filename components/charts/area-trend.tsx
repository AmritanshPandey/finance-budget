'use client'

import { useId } from 'react'

export interface TrendPoint {
  label: string
  value: number
}

/** Catmull-Rom through the points, converted to cubic beziers. */
function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  return d
}

/**
 * A spending line with the area beneath it filled. Deliberately unlabelled —
 * the shape is the message; the figures live in the tiles below it.
 */
export function AreaTrend({
  points,
  height = 132,
  markerIndex,
  className,
}: {
  points: TrendPoint[]
  height?: number
  markerIndex?: number
  className?: string
}) {
  const gradientId = useId()
  const width = 320
  const padY = 14

  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs opacity-70"
        style={{ height }}
      >
        Not enough history yet
      </div>
    )
  }

  const values = points.map((p) => p.value)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1

  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * width,
    y: padY + (1 - (p.value - min) / span) * (height - padY * 2),
  }))

  const line = smoothPath(coords)
  const area = `${line} L ${width} ${height} L 0 ${height} Z`
  const marker = markerIndex !== undefined ? coords[markerIndex] : undefined

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ height, width: '100%' }}
      role="img"
      aria-label="Spending over time"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {marker && (
        <>
          <line
            x1={marker.x}
            y1={marker.y}
            x2={marker.x}
            y2={height}
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.5}
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={marker.x} cy={marker.y} r={5} fill="currentColor" />
          <circle cx={marker.x} cy={marker.y} r={2.2} fill="var(--card)" />
        </>
      )}
    </svg>
  )
}
