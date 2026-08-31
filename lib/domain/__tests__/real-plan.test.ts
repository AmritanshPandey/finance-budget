import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { buildRealPlan } from './fixtures/real-plan'
import { monthActuals } from '../actuals'
import { resolveMonth } from '../resolve-month'
import { scheduledChanges } from '../schedule'
import { formatINR, toPaise } from '../money'

const doc = buildRealPlan()

/** Everything that leaves the account in a month: spending, EMIs and investing. */
function outgoings(month: string) {
  const view = resolveMonth(doc, month)
  return view.expenses + view.emis + view.investments
}

describe("the user's three budget periods", () => {
  it('October and November come to ₹1,77,600', () => {
    expect(outgoings('2026-10')).toBe(toPaise(177_600))
    expect(outgoings('2026-11')).toBe(toPaise(177_600))
  })

  it('December through February come to ₹1,77,600', () => {
    for (const month of ['2026-12', '2027-01', '2027-02']) {
      expect(outgoings(month), month).toBe(toPaise(177_600))
    }
  })

  it('March through August come to ₹1,90,663', () => {
    for (const month of ['2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08']) {
      expect(outgoings(month), month).toBe(toPaise(190_663))
    }
  })
})

describe('the loans step down as three separate borrowings', () => {
  const emisIn = (month: string) => resolveMonth(doc, month).emis

  it('matches the spreadsheet at every step', () => {
    expect(emisIn('2026-10')).toBe(toPaise(78_000))
    expect(emisIn('2026-11')).toBe(toPaise(78_000))
    expect(emisIn('2026-12')).toBe(toPaise(47_663))
    expect(emisIn('2027-02')).toBe(toPaise(47_663))
    expect(emisIn('2027-03')).toBe(toPaise(41_063))
  })
})

describe('lines that come and go', () => {
  const amountIn = (month: string, name: string) =>
    resolveMonth(doc, month).lines.find((l) => l.categoryName === name)?.amount ?? 0

  it('car parking stops after November', () => {
    expect(amountIn('2026-11', 'Car parking')).toBe(toPaise(1_500))
    expect(amountIn('2026-12', 'Car parking')).toBe(0)
  })

  it('shifting and travel run only through the move', () => {
    expect(amountIn('2026-11', 'Shifting')).toBe(0)
    expect(amountIn('2027-01', 'Shifting')).toBe(toPaise(10_000))
    expect(amountIn('2027-01', 'Travel')).toBe(toPaise(25_000))
    expect(amountIn('2027-03', 'Travel')).toBe(0)
  })

  it('going out pauses through the move and returns higher', () => {
    expect(amountIn('2026-11', 'Going out')).toBe(toPaise(2_500))
    expect(amountIn('2027-01', 'Going out')).toBe(0)
    expect(amountIn('2027-03', 'Going out')).toBe(toPaise(6_000))
  })

  it('groceries absorbs personal care from March', () => {
    expect(amountIn('2027-02', 'Groceries')).toBe(toPaise(11_000))
    expect(amountIn('2027-02', 'Personal care and protein')).toBe(toPaise(10_000))
    expect(amountIn('2027-03', 'Groceries')).toBe(toPaise(22_000))
    expect(amountIn('2027-03', 'Personal care and protein')).toBe(0)
  })
})

describe('the set-asides are savings, not spending', () => {
  it('counts as investing rather than disappearing', () => {
    const march = resolveMonth(doc, '2027-03')
    // ELSS 5,000 + NPS 5,500 + Emergency fund 50,000 + Cash 15,000.
    expect(march.investments).toBe(toPaise(75_500))
  })

  it('keeps NPS locked away from goals and the rest reachable', () => {
    const locked = doc.categories.filter((c) => c.locked).map((c) => c.name)
    expect(locked).toEqual(['NPS'])
  })
})

describe('the plan is legible as a schedule', () => {
  it('lists every step, not just the last of each line', () => {
    const changes = scheduledChanges(doc, '2026-10')
    // Two loans finishing, plus the March and December steps across the lines.
    expect(changes.length).toBeGreaterThan(12)
    expect(changes[0].month).toBe('2026-11')
    expect(changes.some((c) => c.kind === 'loanEnd')).toBe(true)
    expect(changes.some((c) => c.kind === 'ends')).toBe(true)
  })
})

describe('exporting it', () => {
  it('writes an importable file once every figure above holds', () => {
    // No transactions yet: this is a plan, not a history.
    expect(monthActuals(doc, '2026-10').count).toBe(0)

    const path = 'budget-plan.json'
    writeFileSync(path, JSON.stringify(doc, null, 2))
    expect(doc.version).toBe(2)

    console.log(
      `\n  wrote ${path} — Oct ${formatINR(outgoings('2026-10'))}, ` +
        `Dec ${formatINR(outgoings('2026-12'))}, Mar ${formatINR(outgoings('2027-03'))}\n`,
    )
  })
})
