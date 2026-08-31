import { describe, expect, it } from 'vitest'

import { INFLATION_CLASSES, INVESTMENT_TYPES, inflateOver, investmentType, returnRateFor } from '../rates'
import { project, goalRequiredAmount } from '../projection'
import { addOneOff } from '../mutations'
import { toPaise } from '../money'
import { goal, investing, plainDoc, withGoals } from './helpers'

const NOW = '2026-01'

describe('the rate library', () => {
  it('assumes nothing until something is named', () => {
    expect(INFLATION_CLASSES[0].ratePct).toBe(0)
    expect(INVESTMENT_TYPES[0].ratePct).toBe(0)
    expect(returnRateFor(undefined, undefined)).toBe(0)
    expect(returnRateFor('none', undefined)).toBe(0)
  })

  it('carries a rate once a type is chosen', () => {
    expect(investmentType('fd').ratePct).toBe(7)
    expect(investmentType('equity-mf').ratePct).toBe(12)
  })

  it('lets a line override its type', () => {
    expect(returnRateFor('equity-mf', 8)).toBe(8)
  })

  it('falls back rather than throwing on an unknown key', () => {
    expect(investmentType('cryptokitties').ratePct).toBe(0)
  })
})

describe('each pot grows at its own rate', () => {
  it('an equity fund outpaces a fixed deposit from the same contribution', () => {
    const base = plainDoc(NOW)
    const equity = investing(base, 'ELSS', 10_000, false, 'equity-mf')
    const fd = investing(base, 'ELSS', 10_000, false, 'fd')

    const after5y = (d: typeof base) => project(d, { now: NOW }).months[59]
    const equityPot = after5y(equity).investedAvailable
    const fdPot = after5y(fd).investedAvailable

    // Same ₹6,00,000 put in either way; only the growth differs.
    expect(equityPot).toBeGreaterThan(fdPot)
    expect(equityPot).toBeGreaterThan(toPaise(800_000))
    expect(fdPot).toBeGreaterThan(toPaise(600_000))
    expect(fdPot).toBeLessThan(toPaise(730_000))
  })

  it('compounds a lump sum at the type rate', () => {
    const base = investing(plainDoc(NOW), 'ELSS', 0, false, 'equity-mf')
    const elss = base.categories.find((c) => c.name === 'ELSS')!.id
    const doc = addOneOff(base, {
      month: '2026-02',
      amount: toPaise(100_000),
      direction: 'out',
      label: 'Lump',
      investIntoCategoryId: elss,
    })
    // ₹1,00,000 at 12%/yr, compounded monthly for a year ≈ ₹1,12,683.
    const months = project(doc, { now: NOW }).months
    // The lump grows in the month it lands, so it is ₹1,01,000 straight away.
    expect(months[1].investedAvailable).toBe(toPaise(101_000))
    // Twelve further months at 1% a month ≈ ₹1,13,809.
    const twelveOn = months[13].investedAvailable
    expect(twelveOn).toBeGreaterThan(toPaise(113_700))
    expect(twelveOn).toBeLessThan(toPaise(113_900))
  })

  it('reports each pot separately so the mix is visible', () => {
    let doc = investing(plainDoc(NOW), 'ELSS', 5_000, false, 'equity-mf')
    doc = investing(doc, 'NPS', 5_000, true, 'nps')
    const month = project(doc, { now: NOW }).months[11]

    expect(Object.keys(month.pots)).toHaveLength(2)
    expect(month.investedLocked).toBeGreaterThan(0)
    expect(month.investedAvailable).toBeGreaterThan(0)
    // What went in is tracked apart from what it grew to.
    const put = Object.values(month.contributed).reduce((a, b) => a + b, 0)
    expect(put).toBe(toPaise(120_000))
    expect(month.investedAvailable + month.investedLocked).toBeGreaterThan(put)
  })
})

describe('goals priced in today’s money', () => {
  const masters = goal({ name: "Master's", rupees: 2_000_000, targetMonth: '2029-01' })

  it('inflates to what it will actually cost', () => {
    // ₹20,00,000 at 10% education inflation, three years out.
    const withClass = { ...masters, inflationClass: 'education' }
    expect(goalRequiredAmount(withClass, NOW)).toBe(toPaise(2_662_000))
  })

  it('takes a future price literally', () => {
    const stated = { ...masters, inflationClass: 'education', amountIn: 'future' as const }
    expect(goalRequiredAmount(stated, NOW)).toBe(toPaise(2_000_000))
  })

  it('leaves an unclassified goal alone', () => {
    expect(goalRequiredAmount(masters, NOW)).toBe(toPaise(2_000_000))
  })

  it('reports both figures, and funds the real one', () => {
    const doc = withGoals(plainDoc(NOW), [{ ...masters, inflationClass: 'education' }])
    const [outcome] = project(doc, { now: NOW }).goalOutcomes
    expect(outcome.targetAmount).toBe(toPaise(2_000_000))
    expect(outcome.requiredAmount).toBe(toPaise(2_662_000))
  })

  it('lands later once the real price is used', () => {
    // ₹25L is affordable by the target date; ₹33.3L is not.
    const bigger = goal({ name: "Master's", rupees: 2_500_000, targetMonth: '2029-01' })
    const flat = withGoals(plainDoc(NOW), [bigger])
    const inflated = withGoals(plainDoc(NOW), [{ ...bigger, inflationClass: 'education' }])

    const a = project(flat, { now: NOW }).goalOutcomes[0]
    const b = project(inflated, { now: NOW }).goalOutcomes[0]

    expect(a.status).toBe('onTime')
    expect(b.status).toBe('late')
    expect(b.fundedMonth! > a.fundedMonth!).toBe(true)
  })
})

describe('inflateOver', () => {
  it('is a no-op without a rate or a gap', () => {
    expect(inflateOver(1000, 0, 120)).toBe(1000)
    expect(inflateOver(1000, 10, 0)).toBe(1000)
  })
})
