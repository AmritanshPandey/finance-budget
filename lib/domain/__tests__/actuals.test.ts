import { describe, expect, it } from 'vitest'

import { hasActuals, monthActuals, recentTransactions, suggestCategory } from '../actuals'
import { addTransaction } from '../mutations'
import { project } from '../projection'
import { toPaise } from '../money'
import { investing, plainDoc } from './helpers'
import type { BudgetDoc } from '../types'

function categoryId(doc: BudgetDoc, name: string) {
  return doc.categories.find((c) => c.name === name)!.id
}

function spend(doc: BudgetDoc, name: string, date: string, rupees: number, merchant?: string) {
  return addTransaction(doc, {
    date,
    amount: toPaise(rupees),
    direction: 'out',
    categoryId: categoryId(doc, name),
    merchant,
  })
}

describe('bucketing transactions', () => {
  it('counts only the month asked for', () => {
    let doc = plainDoc('2026-01')
    doc = spend(doc, 'Groceries', '2026-01-05', 3_000)
    doc = spend(doc, 'Groceries', '2026-01-20', 2_000)
    doc = spend(doc, 'Groceries', '2026-02-02', 9_999)

    const jan = monthActuals(doc, '2026-01')
    expect(jan.spent).toBe(toPaise(5_000))
    expect(jan.count).toBe(2)
    expect(jan.byCategory.get(categoryId(doc, 'Groceries'))).toBe(toPaise(5_000))
    expect(monthActuals(doc, '2026-03').count).toBe(0)
    expect(hasActuals(doc, '2026-03')).toBe(false)
  })

  it('keeps investing out of "spent" but still records it', () => {
    let doc = investing(plainDoc('2026-01'), 'ELSS', 5_000, false)
    doc = investing(doc, 'NPS', 5_000, true)
    doc = spend(doc, 'ELSS', '2026-01-03', 5_000)
    doc = spend(doc, 'NPS', '2026-01-03', 5_000)
    doc = spend(doc, 'Groceries', '2026-01-04', 1_000)

    const jan = monthActuals(doc, '2026-01')
    expect(jan.spent).toBe(toPaise(1_000))
    expect(jan.investedAvailable).toBe(toPaise(5_000))
    expect(jan.investedLocked).toBe(toPaise(5_000))
  })

  it('lists the newest transactions first', () => {
    let doc = plainDoc('2026-01')
    doc = spend(doc, 'Groceries', '2026-01-05', 100, 'Older')
    doc = spend(doc, 'Groceries', '2026-01-25', 200, 'Newer')
    expect(recentTransactions(doc, 1)[0].merchant).toBe('Newer')
  })
})

describe('actuals drive months that have ended', () => {
  const now = '2026-04'

  it('replaces planned spending with what really went out', () => {
    let doc = plainDoc('2026-01')
    // Planned outgoings are ₹25,000; only ₹5,000 actually left in January.
    doc = spend(doc, 'Groceries', '2026-01-10', 5_000)

    const p = project(doc, { now })
    const jan = p.months[0]
    expect(jan.settled).toBe(true)
    expect(jan.expenses).toBe(toPaise(5_000))
    expect(jan.surplus).toBe(toPaise(95_000))
  })

  it('leaves the current month and the future on the plan', () => {
    let doc = plainDoc('2026-01')
    doc = spend(doc, 'Groceries', '2026-04-10', 5_000)

    const april = project(doc, { now }).months.find((m) => m.month === now)
    expect(april?.settled).toBe(false)
    expect(april?.expenses).toBe(toPaise(25_000))
  })

  it('falls back to the plan for a past month with nothing logged', () => {
    const p = project(plainDoc('2026-01'), { now })
    expect(p.months[0].settled).toBe(false)
    expect(p.months[0].surplus).toBe(toPaise(75_000))
  })

  it('keeps planned income when only spending was logged', () => {
    let doc = plainDoc('2026-01')
    doc = spend(doc, 'Groceries', '2026-01-10', 5_000)
    // Income was never logged, so the ₹1,00,000 plan still stands.
    expect(project(doc, { now }).months[0].income).toBe(toPaise(100_000))
  })

  it('uses logged income when there is some', () => {
    let doc = plainDoc('2026-01')
    doc = spend(doc, 'Groceries', '2026-01-10', 5_000)
    doc = addTransaction(doc, {
      date: '2026-01-01',
      amount: toPaise(90_000),
      direction: 'in',
      categoryId: categoryId(doc, 'Salary'),
    })
    const jan = project(doc, { now }).months[0]
    expect(jan.income).toBe(toPaise(90_000))
    expect(jan.surplus).toBe(toPaise(85_000))
  })

  it('carries the corrected balance forward into the forecast', () => {
    let doc = plainDoc('2026-01')
    for (const month of ['01', '02', '03']) {
      doc = spend(doc, 'Groceries', `2026-${month}-10`, 5_000)
    }
    const p = project(doc, { now })
    // Three settled months of ₹95,000 rather than the planned ₹75,000.
    expect(p.months[2].closingBalance).toBe(toPaise(285_000))
    expect(p.months[3].settled).toBe(false)
  })
})

describe('merchant memory', () => {
  it('remembers a merchant the keyword table has never heard of', () => {
    let doc = plainDoc('2026-01')
    expect(suggestCategory(doc, 'Bombay Canteen')).toBeNull()

    doc = spend(doc, 'Going out', '2026-01-10', 400, 'Bombay Canteen')
    expect(suggestCategory(doc, 'Bombay Canteen')).toBe(categoryId(doc, 'Going out'))
    // Punctuation and case must not defeat it.
    expect(suggestCategory(doc, 'bombay canteen!')).toBe(categoryId(doc, 'Going out'))
  })

  it('knows a well-known merchant before it has ever been used', () => {
    // "Swiggy" is a dining keyword and Going out wears the same icon.
    const doc = plainDoc('2026-01')
    expect(suggestCategory(doc, 'Swiggy')).toBe(categoryId(doc, 'Going out'))
  })

  it('lets a remembered choice override the keyword guess', () => {
    let doc = plainDoc('2026-01')
    doc = spend(doc, 'Groceries', '2026-01-10', 400, 'Swiggy')
    expect(suggestCategory(doc, 'Swiggy')).toBe(categoryId(doc, 'Groceries'))
  })

  it('falls back to the keyword table for an unseen merchant', () => {
    const doc = plainDoc('2026-01')
    // "Blinkit" is a groceries keyword, and Groceries wears the basket icon.
    expect(suggestCategory(doc, 'Blinkit')).toBe(categoryId(doc, 'Groceries'))
  })

  it('settles for the same kind of spending when no exact icon matches', () => {
    const doc = plainDoc('2026-01')
    // Uber reads as a cab; the only transport category wears a bus.
    expect(suggestCategory(doc, 'Uber')).toBe(categoryId(doc, 'Commute'))
    expect(suggestCategory(doc, 'IRCTC')).toBe(categoryId(doc, 'Commute'))
  })

  it('gives up rather than guessing wildly', () => {
    expect(suggestCategory(plainDoc('2026-01'), 'Quantum flux capacitor')).toBeNull()
  })
})

describe('migrating an older document', () => {
  it('fills in fields added after it was written', async () => {
    const { migrate } = await import('../migrate')
    const doc = plainDoc('2026-01')
    // A document exported before transactions, merchant memory or looks existed.
    const legacy = {
      ...doc,
      categories: doc.categories.map(({ ...c }) => {
        delete (c as { icon?: string }).icon
        delete (c as { color?: string }).color
        return c
      }),
    } as BudgetDoc
    delete (legacy as Partial<BudgetDoc>).transactions
    delete (legacy as Partial<BudgetDoc>).merchantMemory

    const migrated = migrate(legacy)
    expect(migrated.transactions).toEqual([])
    expect(migrated.merchantMemory).toEqual({})
    expect(migrated.categories.find((c) => c.name === 'Rent')?.icon).toBe('home')
  })

  it('never overwrites a look the user chose by hand', async () => {
    const { migrate } = await import('../migrate')
    const doc = plainDoc('2026-01')
    const custom = {
      ...doc,
      categories: doc.categories.map((c) =>
        c.name === 'Rent' ? { ...c, icon: 'heart', color: 'pink' } : c,
      ),
    }
    const migrated = migrate(custom)
    expect(migrated.categories.find((c) => c.name === 'Rent')?.icon).toBe('heart')
  })
})
