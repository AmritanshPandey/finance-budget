import { describe, expect, it } from 'vitest'

import { describePlan, flatPlan, planFromVersions, planToVersions } from '../plan'
import { setLineVersionsByName } from '../factory'
import { resolveMonth } from '../resolve-month'
import { toPaise } from '../money'
import { plainDoc } from './helpers'
import type { LinePlan } from '../plan'

/** The user's real loan: two small borrowings clearing at different dates. */
const STEPPING_LOAN: LinePlan = {
  steps: [
    { from: '2026-10', amount: toPaise(78_000) },
    { from: '2026-12', amount: toPaise(47_663) },
    { from: '2027-03', amount: toPaise(41_063) },
  ],
  growthRatePct: 0,
}

describe('a line that changes more than once', () => {
  it('holds each amount until the next step', () => {
    const doc = setLineVersionsByName(
      plainDoc('2026-10'),
      'Rent',
      planToVersions(STEPPING_LOAN, 'Rent'),
    )
    const at = (month: string) =>
      resolveMonth(doc, month).lines.find((l) => l.categoryName === 'Rent')?.amount

    expect(at('2026-10')).toBe(toPaise(78_000))
    expect(at('2026-11')).toBe(toPaise(78_000))
    expect(at('2026-12')).toBe(toPaise(47_663))
    expect(at('2027-02')).toBe(toPaise(47_663))
    expect(at('2027-03')).toBe(toPaise(41_063))
    expect(at('2029-01')).toBe(toPaise(41_063))
  })

  it('round-trips without losing a step', () => {
    const versions = planToVersions(STEPPING_LOAN, 'Rent')
    expect(planFromVersions(versions)).toEqual(STEPPING_LOAN)
  })

  it('survives the steps being given out of order', () => {
    const jumbled: LinePlan = { ...STEPPING_LOAN, steps: [...STEPPING_LOAN.steps].reverse() }
    expect(planToVersions(jumbled, 'Rent').map((v) => v.from)).toEqual([
      '2026-10',
      '2026-12',
      '2027-03',
    ])
  })
})

describe('steps combined with an ending', () => {
  const plan: LinePlan = {
    steps: [
      { from: '2026-10', amount: toPaise(8_500) },
      { from: '2026-12', amount: toPaise(7_837) },
    ],
    growthRatePct: 0,
    endsAfter: '2027-02',
  }

  it('runs through the end month then stops', () => {
    const doc = setLineVersionsByName(
      plainDoc('2026-10'),
      'House help',
      planToVersions(plan, 'House help'),
    )
    const at = (month: string) =>
      resolveMonth(doc, month).lines.find((l) => l.categoryName === 'House help')?.amount

    expect(at('2026-11')).toBe(toPaise(8_500))
    expect(at('2027-02')).toBe(toPaise(7_837))
    expect(at('2027-03')).toBe(0)
  })

  it('round-trips the ending as an ending, not a change to zero', () => {
    expect(planFromVersions(planToVersions(plan, 'House help'))).toEqual(plan)
  })
})

describe('a line that starts mid-plan and stops again', () => {
  it('is nothing before it starts and nothing after it ends', () => {
    // "Travel ₹25,000, December to February" — temporary by design.
    const plan: LinePlan = {
      steps: [{ from: '2026-12', amount: toPaise(25_000) }],
      growthRatePct: 0,
      endsAfter: '2027-02',
    }
    const doc = setLineVersionsByName(plainDoc('2026-10'), 'Going out', planToVersions(plan, 'Travel'))
    const at = (month: string) =>
      resolveMonth(doc, month).lines.find((l) => l.categoryName === 'Going out')?.amount

    expect(at('2026-11')).toBeUndefined()
    expect(at('2026-12')).toBe(toPaise(25_000))
    expect(at('2027-02')).toBe(toPaise(25_000))
    expect(at('2027-03')).toBe(0)
  })
})

describe('growth applies from the last step', () => {
  it('compounds off the newest amount, not the original', () => {
    const plan: LinePlan = {
      steps: [
        { from: '2026-10', amount: toPaise(30_000) },
        { from: '2027-03', amount: toPaise(15_000) },
      ],
      growthRatePct: 10,
    }
    const doc = setLineVersionsByName(plainDoc('2026-10'), 'Rent', planToVersions(plan, 'Rent'))
    const at = (month: string) =>
      resolveMonth(doc, month).lines.find((l) => l.categoryName === 'Rent')?.amount

    expect(at('2027-02')).toBe(toPaise(30_000))
    expect(at('2027-03')).toBe(toPaise(15_000))
    expect(at('2028-03')).toBe(toPaise(16_500))
  })
})

describe('describing a plan', () => {
  it('says nothing is happening when nothing is', () => {
    expect(describePlan(flatPlan('2026-10', toPaise(30_000)))).toBe('Same every month')
  })

  it('names a single change', () => {
    expect(
      describePlan({
        steps: [
          { from: '2026-10', amount: toPaise(30_000) },
          { from: '2027-03', amount: toPaise(15_000) },
        ],
        growthRatePct: 0,
      }),
    ).toBe('₹15,000 from Mar 2027')
  })

  it('counts them once there are several', () => {
    expect(describePlan(STEPPING_LOAN)).toBe('2 changes ahead')
  })

  it('mentions an ending alongside the steps', () => {
    expect(
      describePlan({
        steps: [{ from: '2026-10', amount: toPaise(7_500) }],
        growthRatePct: 0,
        endsAfter: '2027-07',
      }),
    ).toBe('stops after Jul 2027')
  })
})
