import { describe, expect, it } from 'vitest'

import { cadenceToVersions } from '../cadence'
import { setLineVersionsByName } from '../factory'
import { addLoan, addOneOff, setLineAmount, setLineCadence } from '../mutations'
import { project } from '../projection'
import { scheduledChanges } from '../schedule'
import { toPaise } from '../money'
import { investing, plainDoc } from './helpers'
import type { BudgetDoc } from '../types'

const NOW = '2026-08'

function lineIdFor(doc: BudgetDoc, name: string) {
  const category = doc.categories.find((c) => c.name === name)!
  return doc.templateLines.find((l) => l.categoryId === category.id)!.id
}

describe('what is coming', () => {
  it('lists a dated change on a line', () => {
    const doc = setLineVersionsByName(
      plainDoc(NOW),
      'Rent',
      cadenceToVersions(NOW, toPaise(30_000), { mode: 'changes', from: '2027-04', amount: toPaise(38_000) }, 'Rent'),
    )
    const [change] = scheduledChanges(doc, NOW).filter((c) => c.kind === 'change')
    expect(change.month).toBe('2027-04')
    expect(change.title).toBe('Rent')
    expect(change.detail).toBe('becomes ₹38,000')
  })

  it('reports an ending as the last month it runs, not the first month it does not', () => {
    const doc = setLineVersionsByName(
      plainDoc(NOW),
      'Subscriptions',
      cadenceToVersions(NOW, toPaise(7_500), { mode: 'ends', after: '2027-12' }, 'Subscriptions'),
    )
    const [ending] = scheduledChanges(doc, NOW).filter((c) => c.kind === 'ends')
    expect(ending.month).toBe('2027-12')
    expect(ending.detail).toBe('stops after Dec 2027')
  })

  it('includes loans starting and finishing', () => {
    const doc = addLoan(plainDoc(NOW), {
      name: 'Car loan',
      spec: { mode: 'emi', emi: toPaise(20_000) },
      tenureMonths: 24,
      startMonth: '2027-01',
    })
    const kinds = scheduledChanges(doc, NOW)
    expect(kinds.find((c) => c.kind === 'loanStart')?.month).toBe('2027-01')
    expect(kinds.find((c) => c.kind === 'loanEnd')?.month).toBe('2028-12')
  })

  it('includes one-offs and single-month overrides', () => {
    let doc = addOneOff(plainDoc(NOW), {
      month: '2027-04',
      amount: toPaise(200_000),
      direction: 'in',
      label: 'Bonus',
    })
    doc = setLineAmount(doc, '2027-02', lineIdFor(doc, 'Rent'), toPaise(50_000), 'month')

    const changes = scheduledChanges(doc, NOW)
    expect(changes.find((c) => c.kind === 'oneOff')?.detail).toBe('+₹2,00,000 one-off')
    expect(changes.find((c) => c.kind === 'override')?.detail).toBe(
      '₹50,000 for this month only',
    )
  })

  it('is ordered soonest first and ignores the past', () => {
    let doc = addOneOff(plainDoc(NOW), {
      month: '2028-01',
      amount: toPaise(1),
      direction: 'in',
      label: 'Later',
    })
    doc = addOneOff(doc, { month: '2027-01', amount: toPaise(1), direction: 'in', label: 'Sooner' })
    doc = addOneOff(doc, { month: '2026-01', amount: toPaise(1), direction: 'in', label: 'Gone' })

    const titles = scheduledChanges(doc, NOW)
      .filter((c) => c.kind === 'oneOff')
      .map((c) => c.title)
    expect(titles).toEqual(['Sooner', 'Later'])
  })
})

describe('re-planning a line', () => {
  it('leaves history alone and rewrites the future', () => {
    const base = plainDoc('2026-01')
    const lineId = lineIdFor(base, 'Rent')
    // A change already made in the past must survive.
    let doc = setLineAmount(base, '2026-03', lineId, toPaise(28_000), 'future')
    doc = setLineCadence(doc, lineId, { mode: 'grows', ratePct: 10 }, NOW, toPaise(28_000), 'Rent')

    const versions = doc.templateLines.find((l) => l.id === lineId)!.versions
    expect(versions.map((v) => v.from)).toEqual(['2026-01', '2026-03', '2026-08'])
    expect(versions[2].growthRatePct).toBe(10)
  })

  it('clears overrides it would otherwise shadow', () => {
    const base = plainDoc('2026-01')
    const lineId = lineIdFor(base, 'Rent')
    let doc = setLineAmount(base, '2027-02', lineId, toPaise(99_000), 'month')
    expect(doc.overrides).toHaveLength(1)

    doc = setLineCadence(doc, lineId, { mode: 'flat' }, NOW, toPaise(25_000), 'Rent')
    expect(doc.overrides).toHaveLength(0)
  })
})

describe('a lump sum into an investment', () => {
  it('leaves cash but joins the pot', () => {
    const base = investing(plainDoc(NOW), 'ELSS', 0, false)
    const elss = base.categories.find((c) => c.name === 'ELSS')!.id
    const doc = addOneOff(base, {
      month: '2026-09',
      amount: toPaise(100_000),
      direction: 'out',
      label: 'Bonus into ELSS',
      investIntoCategoryId: elss,
    })

    const plain = project(base, { now: NOW }).months[1]
    const withLump = project(doc, { now: NOW }).months[1]

    expect(withLump.closingBalance).toBe(plain.closingBalance - toPaise(100_000))
    expect(withLump.investedAvailable).toBe(toPaise(100_000))
    // Wealth is unchanged: the money moved, it did not disappear.
    expect(withLump.netWorth).toBe(plain.netWorth)
  })

  it('respects a locked pot', () => {
    const base = investing(plainDoc(NOW), 'NPS', 0, true)
    const nps = base.categories.find((c) => c.name === 'NPS')!.id
    const doc = addOneOff(base, {
      month: '2026-09',
      amount: toPaise(50_000),
      direction: 'out',
      label: 'NPS top-up',
      investIntoCategoryId: nps,
    })
    const month = project(doc, { now: NOW }).months[1]
    expect(month.investedLocked).toBe(toPaise(50_000))
    expect(month.investedAvailable).toBe(0)
  })
})
