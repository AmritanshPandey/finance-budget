import { describe, expect, it } from 'vitest'

import { costOverHorizon, investmentSummary, loanSummary, savingsSummary } from '../summary'
import { project } from '../projection'
import { toPaise } from '../money'
import { buildRealPlan } from './fixtures/real-plan'
import { investing, plainDoc } from './helpers'
import { setLineVersionsByName } from '../factory'
import { planToVersions } from '../plan'

const NOW = '2026-01'

describe('investments breakdown', () => {
  it('separates what you put in from what it grew to', () => {
    let doc = investing(plainDoc(NOW), 'ELSS', 10_000, false, 'equity-mf')
    doc = investing(doc, 'NPS', 5_000, true, 'nps')
    const summary = investmentSummary(doc, project(doc, { now: NOW }), '2030-12')

    expect(summary.rows).toHaveLength(2)
    expect(summary.contributed).toBeGreaterThan(0)
    expect(summary.growth).toBeGreaterThan(0)
    expect(summary.value).toBe(summary.contributed + summary.growth)
    expect(summary.available + summary.locked).toBe(summary.value)
  })

  it('names the instrument and its rate', () => {
    const doc = investing(plainDoc(NOW), 'ELSS', 5_000, false, 'fd')
    const row = investmentSummary(doc, project(doc, { now: NOW }), '2027-01').rows[0]
    expect(row.typeLabel).toBe('Fixed deposit')
    expect(row.ratePct).toBe(7)
  })

  it('shows no growth for something never named', () => {
    const doc = investing(plainDoc(NOW), 'ELSS', 5_000, false)
    const summary = investmentSummary(doc, project(doc, { now: NOW }), '2030-12')
    expect(summary.growth).toBe(0)
    expect(summary.value).toBe(summary.contributed)
  })
})

describe('loan summary', () => {
  const doc = buildRealPlan()

  it("orders by when each clears and reports what's still to pay", () => {
    const summary = loanSummary(doc, '2026-10')
    expect(summary.rows.map((r) => r.name)).toEqual([
      'Loan ending Nov',
      'Loan ending Feb',
      'Main loan',
    ])
    expect(summary.monthlyNow).toBe(toPaise(78_000))
    // 30,337×2 + 6,600×5 + 41,063×60
    expect(summary.remaining).toBe(toPaise(30_337 * 2 + 6_600 * 5 + 41_063 * 60))
  })

  it('says when the last one clears, and what actually comes back then', () => {
    const summary = loanSummary(doc, '2026-10')
    expect(summary.freeFrom).toBe('2031-10')
    // Only the main loan is still running by then — not the whole ₹78,000.
    expect(summary.freedAmount).toBe(toPaise(41_063))
  })

  it('will not invent interest it cannot know', () => {
    // Every one of these was given as an EMI, so no principal is known.
    expect(loanSummary(doc, '2026-10').interest).toBeNull()
  })
})

describe('savings rate and runway', () => {
  it('reports the share of income kept', () => {
    const doc = plainDoc(NOW)
    const summary = savingsSummary(project(doc, { now: NOW }), NOW)
    // ₹1,00,000 in, ₹25,000 out.
    expect(summary.kept).toBe(toPaise(75_000))
    expect(summary.ratePct).toBe(75)
  })

  it('counts runway in months of spending', () => {
    const base = plainDoc(NOW)
    const doc = { ...base, settings: { ...base.settings, startingBalance: toPaise(250_000) } }
    // ₹2,50,000 opening plus the first month's ₹75,000, over ₹25,000 a month.
    expect(savingsSummary(project(doc, { now: NOW }), NOW).runwayMonths).toBe(13)
  })

  it('does not divide by zero when nothing is spent', () => {
    const base = plainDoc(NOW)
    const doc = setLineVersionsByName(
      base,
      'Rent',
      planToVersions({ steps: [{ from: NOW, amount: 0 }], growthRatePct: 0 }, 'Rent'),
    )
    expect(savingsSummary(project(doc, { now: NOW }), NOW).runwayMonths).toBeGreaterThan(0)
  })
})

describe('what each habit costs over the plan', () => {
  const doc = buildRealPlan()

  it('adds a line up across every month it runs', () => {
    const { rows } = costOverHorizon(doc, '2026-10', 12)
    const subs = rows.find((r) => r.name === 'Subscriptions')
    // ₹7,500 every month for twelve months.
    expect(subs?.total).toBe(toPaise(90_000))
    expect(subs?.months).toBe(12)
  })

  it('counts a line only for the months it actually runs', () => {
    const { rows } = costOverHorizon(doc, '2026-10', 12)
    const travel = rows.find((r) => r.name === 'Travel')
    // December to February only.
    expect(travel?.months).toBe(3)
    expect(travel?.total).toBe(toPaise(75_000))
  })

  it('ranks the biggest cost first, and names each loan', () => {
    const { rows } = costOverHorizon(doc, '2026-10', 12)
    expect(rows[0].name).toBe('Main loan')
    expect(rows.map((r) => r.name)).toContain('Loan ending Nov')
  })

  it('leaves investing out — it is money kept, not spent', () => {
    const { rows } = costOverHorizon(doc, '2026-10', 24)
    expect(rows.map((r) => r.name)).not.toContain('Emergency fund')
    expect(rows.map((r) => r.name)).not.toContain('ELSS')
  })
})
