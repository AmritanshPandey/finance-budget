import { describe, expect, it } from 'vitest'

import { cadenceFromVersions, cadenceToVersions, describeCadence } from '../cadence'
import { resolveMonth } from '../resolve-month'
import { toPaise } from '../money'
import { plainDoc } from './helpers'
import { setLineVersionsByName } from '../factory'

describe('cadence to versions', () => {
  it('holds steady', () => {
    const versions = cadenceToVersions('2026-08', toPaise(7_500), { mode: 'flat' }, 'Subscriptions')
    expect(versions).toEqual([{ from: '2026-08', amount: toPaise(7_500), growthRatePct: 0 }])
  })

  it('climbs each year', () => {
    const versions = cadenceToVersions(
      '2026-08',
      toPaise(30_000),
      { mode: 'grows', ratePct: 8 },
      'Rent',
    )
    expect(versions).toEqual([{ from: '2026-08', amount: toPaise(30_000), growthRatePct: 8 }])
  })

  it('changes on a date, and labels the change for the timeline', () => {
    const versions = cadenceToVersions(
      '2026-08',
      toPaise(30_000),
      { mode: 'changes', from: '2027-04', amount: toPaise(38_000) },
      'Rent',
    )
    expect(versions).toHaveLength(2)
    expect(versions[1]).toEqual({
      from: '2027-04',
      amount: toPaise(38_000),
      growthRatePct: 0,
      label: 'Rent changes',
    })
  })
})

describe('a cadence drives the actual forecast', () => {
  it('a dated change takes effect in its month and not before', () => {
    const doc = setLineVersionsByName(
      plainDoc('2026-08'),
      'Rent',
      cadenceToVersions('2026-08', toPaise(30_000), {
        mode: 'changes',
        from: '2027-04',
        amount: toPaise(38_000),
      }, 'Rent'),
    )
    expect(resolveMonth(doc, '2027-03').expenses).toBe(toPaise(30_000))
    expect(resolveMonth(doc, '2027-04').expenses).toBe(toPaise(38_000))
  })

  it('a climbing line compounds annually', () => {
    const doc = setLineVersionsByName(
      plainDoc('2026-08'),
      'Rent',
      cadenceToVersions('2026-08', toPaise(30_000), { mode: 'grows', ratePct: 10 }, 'Rent'),
    )
    expect(resolveMonth(doc, '2027-08').expenses).toBe(toPaise(33_000))
  })
})

describe('round-tripping', () => {
  it('reads back what it wrote', () => {
    for (const cadence of [
      { mode: 'flat' } as const,
      { mode: 'grows', ratePct: 8 } as const,
      { mode: 'changes', from: '2027-04', amount: toPaise(38_000) } as const,
    ]) {
      const versions = cadenceToVersions('2026-08', toPaise(30_000), cadence, 'Rent')
      expect(cadenceFromVersions(versions)).toEqual(cadence)
    }
  })

  it('describes itself without jargon', () => {
    expect(describeCadence({ mode: 'flat' })).toBe('Same every month')
    expect(describeCadence({ mode: 'grows', ratePct: 8 })).toBe('Climbs 8% a year')
    expect(describeCadence({ mode: 'changes', from: '2027-04', amount: toPaise(38_000) })).toBe(
      'Becomes ₹38,000 in Apr 2027',
    )
  })
})
