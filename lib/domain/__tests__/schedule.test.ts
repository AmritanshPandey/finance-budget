import { describe, expect, it } from 'vitest'

import { planToVersions } from '../plan'
import { setLineVersionsByName } from '../factory'
import { addLoan, addOneOff, setLineAmount, setLinePlan } from '../mutations'
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
      planToVersions({ steps: [{ from: NOW, amount: toPaise(30_000) }, { from: '2027-04', amount: toPaise(38_000) }], growthRatePct: 0 }, 'Rent'),
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
      planToVersions({ steps: [{ from: NOW, amount: toPaise(7_500) }], growthRatePct: 0, endsAfter: '2027-12' }, 'Subscriptions'),
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
  it('keeps every step it is given', () => {
    const base = plainDoc('2026-10')
    const lineId = lineIdFor(base, 'Rent')
    const doc = setLinePlan(
      base,
      lineId,
      {
        steps: [
          { from: '2026-10', amount: toPaise(78_000) },
          { from: '2026-12', amount: toPaise(47_663) },
          { from: '2027-03', amount: toPaise(41_063) },
        ],
        growthRatePct: 0,
      },
      'Rent',
    )
    const versions = doc.templateLines.find((l) => l.id === lineId)!.versions
    expect(versions.map((v) => v.from)).toEqual(['2026-10', '2026-12', '2027-03'])
  })

  it('surfaces every step in what is coming, not just the last', () => {
    const base = plainDoc('2026-10')
    const doc = setLinePlan(
      base,
      lineIdFor(base, 'Rent'),
      {
        steps: [
          { from: '2026-10', amount: toPaise(78_000) },
          { from: '2026-12', amount: toPaise(47_663) },
          { from: '2027-03', amount: toPaise(41_063) },
        ],
        growthRatePct: 0,
      },
      'Rent',
    )
    const changes = scheduledChanges(doc, '2026-10').filter((c) => c.kind === 'change')
    expect(changes.map((c) => c.month)).toEqual(['2026-12', '2027-03'])
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

describe('turning off automatic increases (v1 → v2)', () => {
  it('flattens the yearly rates a version-1 document was given by default', async () => {
    const { migrate } = await import('../migrate')
    const base = plainDoc(NOW)
    const legacy: BudgetDoc = {
      ...base,
      version: 1,
      settings: {
        ...base.settings,
        inflationRatePct: 6,
        incomeGrowthRatePct: 5,
        expectedAnnualReturnPct: 6,
      },
      templateLines: base.templateLines.map((l) => ({
        ...l,
        versions: l.versions.map((v) => ({ ...v, growthRatePct: 8 })),
      })),
    }

    const migrated = migrate(legacy)
    expect(migrated.version).toBe(2)
    expect(migrated.settings.inflationRatePct).toBe(0)
    expect(migrated.settings.incomeGrowthRatePct).toBe(0)
    expect(migrated.settings.expectedAnnualReturnPct).toBe(0)
    expect(
      migrated.templateLines.every((l) => l.versions.every((v) => v.growthRatePct === 0)),
    ).toBe(true)
  })

  it('keeps dated changes, which were deliberate', async () => {
    const { migrate } = await import('../migrate')
    const base = plainDoc(NOW)
    const withChange = setLineVersionsByName(
      base,
      'Rent',
      planToVersions({ steps: [{ from: NOW, amount: toPaise(30_000) }, { from: '2027-04', amount: toPaise(38_000) }], growthRatePct: 0 }, 'Rent'),
    )
    const migrated = migrate({ ...withChange, version: 1 })
    const rent = migrated.templateLines.find(
      (l) => l.categoryId === migrated.categories.find((c) => c.name === 'Rent')!.id,
    )!
    expect(rent.versions).toHaveLength(2)
    expect(rent.versions[1].amount).toBe(toPaise(38_000))
    expect(rent.versions[1].from).toBe('2027-04')
  })

  it('leaves a rate the user set after upgrading alone', async () => {
    const { migrate } = await import('../migrate')
    const base = plainDoc(NOW)
    const deliberate: BudgetDoc = {
      ...base,
      version: 2,
      templateLines: base.templateLines.map((l) => ({
        ...l,
        versions: l.versions.map((v) => ({ ...v, growthRatePct: 8 })),
      })),
    }
    const migrated = migrate(deliberate)
    expect(migrated.templateLines[0].versions[0].growthRatePct).toBe(8)
  })

  it('a fresh budget holds every amount steady', () => {
    const doc = plainDoc(NOW)
    expect(doc.settings.inflationRatePct).toBe(0)
    expect(doc.settings.incomeGrowthRatePct).toBe(0)
    expect(doc.settings.expectedAnnualReturnPct).toBe(0)

    const p = project(doc, { now: NOW })
    // Ten years on, income and outgoings are exactly what they are today.
    expect(p.months[119].income).toBe(p.months[0].income)
    expect(p.months[119].expenses).toBe(p.months[0].expenses)
  })
})
