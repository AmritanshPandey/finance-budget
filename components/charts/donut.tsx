'use client'

export interface DonutSlice {
  label: string
  value: number
  color: string
}

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arc(cx: number, cy: number, outer: number, inner: number, from: number, to: number) {
  // A full circle cannot be drawn as one arc — nudge it just shy of closing.
  const end = to - from >= 360 ? from + 359.99 : to
  const large = end - from > 180 ? 1 : 0
  const o1 = polar(cx, cy, outer, from)
  const o2 = polar(cx, cy, outer, end)
  const i1 = polar(cx, cy, inner, end)
  const i2 = polar(cx, cy, inner, from)
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ')
}

/** Where the money goes, as a ring. Slices under 1.5% are folded together. */
export function Donut({
  slices,
  size = 168,
  thickness = 26,
  children,
}: {
  slices: DonutSlice[]
  size?: number
  thickness?: number
  children?: React.ReactNode
}) {
  const total = slices.reduce((a, s) => a + s.value, 0)
  const cx = size / 2
  const cy = size / 2
  const outer = size / 2
  const inner = outer - thickness

  // Angles are worked out up front: mutating a cursor mid-render is exactly
  // the kind of thing that breaks under concurrent rendering.
  const drawn: Array<DonutSlice & { from: number; to: number }> = []
  if (total > 0) {
    let cursor = 0
    for (const slice of slices) {
      if (slice.value <= 0) continue
      const sweep = (slice.value / total) * 360
      drawn.push({ ...slice, from: cursor, to: cursor + sweep })
      cursor += sweep
    }
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Spending allocation">
        {drawn.length === 0 && (
          <circle cx={cx} cy={cy} r={outer - thickness / 2} fill="none" stroke="var(--muted)" strokeWidth={thickness} />
        )}
        {drawn.map((slice) => (
          <path
            key={slice.label}
            d={arc(cx, cy, outer, inner, slice.from + 0.6, slice.to - 0.6)}
            fill={slice.color}
          />
        ))}
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      )}
    </div>
  )
}
