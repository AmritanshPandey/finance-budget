import { isJanuary } from '@/lib/domain/month'
import type { ProjectedMonth } from '@/lib/domain/types'

export type TimelineRow =
  | { kind: 'month'; month: ProjectedMonth }
  | { kind: 'quiet'; months: ProjectedMonth[] }
  | { kind: 'year'; year: string }

function isNotable(month: ProjectedMonth, index: number): boolean {
  return (
    index === 0 ||
    month.goalsFunded.length > 0 ||
    month.events.length > 0 ||
    month.oneOffs.length > 0
  )
}

/**
 * Quiet stretches collapse into a single band so a decade of nothing-happening
 * takes a thumb-flick rather than a scroll marathon. Year boundaries always
 * break a band, so the reader never loses their place in time.
 */
export function buildRows(months: ProjectedMonth[]): TimelineRow[] {
  const rows: TimelineRow[] = []
  let run: ProjectedMonth[] = []

  function flush() {
    if (run.length === 0) return
    if (run.length <= 2) {
      for (const m of run) rows.push({ kind: 'month', month: m })
    } else {
      rows.push({ kind: 'quiet', months: run })
    }
    run = []
  }

  months.forEach((month, index) => {
    if (isJanuary(month.month) || index === 0) {
      flush()
      rows.push({ kind: 'year', year: month.month.slice(0, 4) })
    }
    if (isNotable(month, index)) {
      flush()
      rows.push({ kind: 'month', month })
    } else {
      run.push(month)
    }
  })
  flush()

  return rows
}
