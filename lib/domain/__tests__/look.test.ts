import { describe, expect, it } from 'vitest'

import { CATEGORY_COLORS, ICON_KEYS, inferLook, matchKeyword } from '../look'
import { SEED_CATEGORIES } from '../factory'

describe('inferring a look from a name', () => {
  it('dresses every seeded category sensibly', () => {
    const expected: Record<string, string> = {
      Salary: 'wallet',
      Rent: 'home',
      'Maintenance, electricity and gas': 'tools',
      'House help': 'spray',
      Subscriptions: 'tv',
      'Life insurance': 'shield',
      "Mom's pocket money": 'family',
      'Car parking': 'parking',
      Groceries: 'basket',
      Commute: 'bus',
      'Personal care and protein': 'salon',
      'Going out': 'kitchen',
      'Credit card': 'card',
      ELSS: 'chart',
      NPS: 'chart',
    }
    for (const seed of SEED_CATEGORIES) {
      expect(inferLook(seed.name).icon, seed.name).toBe(expected[seed.name])
    }
  })

  it('prefers the longest keyword', () => {
    // "credit card" must beat the bare "card" entry.
    expect(inferLook('Credit card').icon).toBe('card')
    // "house help" must beat nothing at all, and never fall through to "home".
    expect(inferLook('House help').icon).toBe('spray')
    // "personal care" beats "car" hiding inside it.
    expect(inferLook('Personal care and protein').icon).toBe('salon')
  })

  it('is case- and punctuation-insensitive', () => {
    expect(inferLook('SWIGGY!!').icon).toBe('kitchen')
    expect(inferLook("McDonald's").icon).toBe('pizza')
    expect(inferLook('  Uber  ').icon).toBe('car')
  })

  it('always returns a key and colour that exist', () => {
    for (const name of ['Rent', 'Zzzz', '', '12345', 'Quantum flux capacitor']) {
      const look = inferLook(name)
      expect(ICON_KEYS).toContain(look.icon)
      expect(CATEGORY_COLORS).toContain(look.color)
    }
  })

  it('gives an unknown name a stable colour', () => {
    const once = inferLook('Quantum flux capacitor')
    const twice = inferLook('Quantum flux capacitor')
    expect(once).toEqual(twice)
    expect(once.icon).toBe('tag')
  })

  it('reports no keyword hit for a name it does not know', () => {
    expect(matchKeyword('Quantum flux capacitor')).toBeNull()
    expect(matchKeyword('')).toBeNull()
    expect(matchKeyword('Groceries')).not.toBeNull()
  })
})

describe('merchants', () => {
  it('recognises the shops people actually type', () => {
    expect(inferLook('Walmart').icon).toBe('bag')
    expect(inferLook('Zomato').icon).toBe('kitchen')
    expect(inferLook('Blinkit').icon).toBe('basket')
    expect(inferLook('IRCTC').icon).toBe('train')
    expect(inferLook('Netflix').icon).toBe('tv')
    expect(inferLook('Cult fitness').icon).toBe('gym')
  })
})
