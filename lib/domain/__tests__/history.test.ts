import { describe, expect, it } from 'vitest'
import { freezeMonth, freezePastMonths, monthsNeedingFreeze } from '../freeze'
import { resolveMonth } from '../resolve-month'
import { project } from '../projection'
import { toPaise } from '../money'
import { plainDoc } from './helpers'
import type { BudgetDoc } from '../types'

function freezeJanuary(doc: BudgetDoc): BudgetDoc {
  return { ...doc, snapshots: [freezeMonth(doc, '2026-01', '2026-02-01')] }
}

describe('frozen months', () => {
  it('survives renaming the category', () => {
    let doc = freezeJanuary(plainDoc())
    doc = {
      ...doc,
      categories: doc.categories.map((c) =>
        c.name === 'Rent' ? { ...c, name: 'House rent (Bangalore)' } : c,
      ),
    }
    const january = resolveMonth(doc, '2026-01')
    expect(january.frozen).toBe(true)
    expect(january.lines.some((l) => l.categoryName === 'Rent')).toBe(true)
    expect(january.expenses).toBe(toPaise(25_000))

    // The live month picks up the new name, as it should.
    expect(
      resolveMonth(doc, '2026-06').lines.some(
        (l) => l.categoryName === 'House rent (Bangalore)',
      ),
    ).toBe(true)
  })

  it('survives archiving the category', () => {
    let doc = freezeJanuary(plainDoc())
    doc = {
      ...doc,
      categories: doc.categories.map((c) =>
        c.name === 'Rent' ? { ...c, archivedAt: '2026-02-10' } : c,
      ),
    }
    expect(resolveMonth(doc, '2026-01').expenses).toBe(toPaise(25_000))
    // Archived from February onward, so it stops appearing in new months.
    expect(resolveMonth(doc, '2026-06').expenses).toBe(0)
  })

  it('survives moving the category to another group', () => {
    let doc = freezeJanuary(plainDoc())
    const otherGroup = doc.groups[doc.groups.length - 1]
    doc = {
      ...doc,
      categories: doc.categories.map((c) =>
        c.name === 'Rent' ? { ...c, groupId: otherGroup.id } : c,
      ),
    }
    expect(resolveMonth(doc, '2026-01').expenses).toBe(toPaise(25_000))
  })

  it('survives deleting the category outright', () => {
    let doc = freezeJanuary(plainDoc())
    const rent = doc.categories.find((c) => c.name === 'Rent')!
    doc = {
      ...doc,
      categories: doc.categories.filter((c) => c.id !== rent.id),
      templateLines: doc.templateLines.filter((l) => l.categoryId !== rent.id),
    }
    const january = resolveMonth(doc, '2026-01')
    expect(january.expenses).toBe(toPaise(25_000))
    expect(january.lines.some((l) => l.categoryName === 'Rent')).toBe(true)
  })
})

describe('freezing', () => {
  it('lists only past months that are not yet frozen', () => {
    const doc = plainDoc()
    expect(monthsNeedingFreeze(doc, '2026-04')).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(monthsNeedingFreeze(doc, '2026-01')).toEqual([])
  })

  it('is idempotent', () => {
    const doc = plainDoc()
    const once = freezePastMonths(doc, '2026-04', '2026-04-01')
    const twice = freezePastMonths({ ...doc, snapshots: once }, '2026-04', '2026-04-01')
    expect(twice).toHaveLength(once.length)
  })
})

describe('versioned template lines', () => {
  it('applies a mid-stream change from its month onward', () => {
    const base = plainDoc()
    const rent = base.categories.find((c) => c.name === 'Rent')!
    const doc: BudgetDoc = {
      ...base,
      templateLines: base.templateLines.map((line) =>
        line.categoryId === rent.id
          ? {
              ...line,
              versions: [
                ...line.versions,
                { from: '2026-07', amount: toPaise(32_000), growthRatePct: 0, label: 'Moved flat' },
              ],
            }
          : line,
      ),
    }
    expect(resolveMonth(doc, '2026-06').expenses).toBe(toPaise(25_000))
    expect(resolveMonth(doc, '2026-07').expenses).toBe(toPaise(32_000))
    expect(resolveMonth(doc, '2027-01').expenses).toBe(toPaise(32_000))

    // The label surfaces as an event pin, in its month only.
    const july = project(doc).months.find((m) => m.month === '2026-07')
    expect(july?.events.map((e) => e.label)).toContain('Moved flat')
    const august = project(doc).months.find((m) => m.month === '2026-08')
    expect(august?.events).toHaveLength(0)
  })

  it('honours a just-this-month override without touching neighbours', () => {
    const base = plainDoc()
    const rentLine = base.templateLines.find(
      (l) => l.categoryId === base.categories.find((c) => c.name === 'Rent')!.id,
    )!
    const doc: BudgetDoc = {
      ...base,
      overrides: [{ month: '2026-05', lineId: rentLine.id, amount: toPaise(50_000) }],
    }
    expect(resolveMonth(doc, '2026-04').expenses).toBe(toPaise(25_000))
    expect(resolveMonth(doc, '2026-05').expenses).toBe(toPaise(50_000))
    expect(resolveMonth(doc, '2026-06').expenses).toBe(toPaise(25_000))
  })
})
