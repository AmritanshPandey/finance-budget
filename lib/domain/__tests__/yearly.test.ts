import { describe, expect, it } from 'vitest'

import { growthPct, monthsCovered, yearlySummary } from '../yearly'
import { buildLifePlan } from './fixtures/life-plan'
import { toPaise } from '../money'

const doc = buildLifePlan()
const summary = yearlySummary(doc)
const row = (name: string) => summary.rows.find((r) => r.name === name)!
const yearIndex = (year: number) => summary.years.indexOf(year)

describe('the plan by year', () => {
  it('spans every year the plan touches', () => {
    expect(summary.years[0]).toBe(2026)
    expect(summary.years[summary.years.length - 1]).toBe(2037)
  })

  it('counts only the months the plan covers', () => {
    // The plan starts in October, so 2026 is three months.
    expect(monthsCovered(doc, 2026)).toBe(3)
    expect(monthsCovered(doc, 2027)).toBe(12)
    expect(monthsCovered(doc, 2037)).toBe(12)
  })

  it('totals a partial first year over its real months', () => {
    expect(summary.totals[0]).toBe(toPaise(177_650 * 3))
  })

  it('totals a full year correctly', () => {
    // 2037 is twelve months at ₹4,54,000.
    expect(summary.totals[summary.years.indexOf(2037)]).toBe(toPaise(454_000 * 12))
  })

  it('adds a line up across the months it runs in each year', () => {
    // Rent: Jan–Feb at ₹30,000, Mar–Dec at ₹16,000.
    expect(row('Rent').byYear[yearIndex(2027)]).toBe(toPaise(30_000 * 2 + 16_000 * 10))
  })

  it("keeps a renamed thing as one row for its whole life", () => {
    const mum = row("Mum's money")
    expect(mum.byYear[yearIndex(2026)]).toBe(toPaise(2_500 * 3))
    expect(mum.byYear[yearIndex(2037)]).toBe(toPaise(10_000 * 12))
  })

  it('ranks the biggest cost first', () => {
    expect(summary.rows[0].total).toBeGreaterThanOrEqual(summary.rows[1].total)
  })

  it('groups agree with the rows they contain', () => {
    const fromGroups = summary.groups.reduce((a, g) => a + g.total, 0)
    const fromRows = summary.rows.reduce((a, r) => a + r.total, 0)
    expect(fromGroups).toBe(fromRows)
  })

  it('group totals agree with the year totals', () => {
    summary.years.forEach((_, i) => {
      const fromGroups = summary.groups.reduce((a, g) => a + g.byYear[i], 0)
      expect(fromGroups).toBe(summary.totals[i])
    })
  })
})

describe('year-on-year change', () => {
  it('reports a rise and a fall', () => {
    expect(growthPct(toPaise(100), toPaise(150))).toBe(50)
    expect(growthPct(toPaise(100), toPaise(75))).toBe(-25)
  })

  it('has nothing to say about two empty years', () => {
    expect(growthPct(0, 0)).toBeNull()
  })

  it('treats a line appearing from nothing as unbounded rather than zero', () => {
    expect(growthPct(0, toPaise(100))).toBe(Infinity)
  })

  it('shows the loans falling away year on year', () => {
    const loans = row('Loans')
    const y27 = loans.byYear[yearIndex(2027)]
    const y28 = loans.byYear[yearIndex(2028)]
    expect(growthPct(y27, y28)).toBeLessThan(0)
    expect(loans.byYear[yearIndex(2030)]).toBe(0)
  })
})
