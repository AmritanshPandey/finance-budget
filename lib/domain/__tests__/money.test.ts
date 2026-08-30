import { describe, expect, it } from 'vitest'
import { compoundMonthly, formatCompactINR, formatINR, parseAmount, toPaise } from '../money'

describe('INR formatting', () => {
  it('groups digits the Indian way', () => {
    expect(formatINR(toPaise(2_000_000))).toBe('₹20,00,000')
    expect(formatINR(toPaise(45_000))).toBe('₹45,000')
    expect(formatINR(toPaise(-1_500))).toBe('-₹1,500')
  })

  it('compacts to lakh and crore', () => {
    expect(formatCompactINR(toPaise(2_000_000))).toBe('₹20L')
    expect(formatCompactINR(toPaise(125_000))).toBe('₹1.3L')
    expect(formatCompactINR(toPaise(12_000_000))).toBe('₹1.2Cr')
    expect(formatCompactINR(toPaise(45_000))).toBe('₹45,000')
  })
})

describe('fast-entry parsing', () => {
  it('accepts the shorthands people actually type', () => {
    expect(parseAmount('20000')).toBe(toPaise(20_000))
    expect(parseAmount('₹20,000')).toBe(toPaise(20_000))
    expect(parseAmount('20k')).toBe(toPaise(20_000))
    expect(parseAmount('20L')).toBe(toPaise(2_000_000))
    expect(parseAmount('1.2cr')).toBe(toPaise(12_000_000))
  })

  it('rejects junk', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
  })
})

describe('compounding', () => {
  it('grows rent at 8%/yr correctly three years out', () => {
    // ₹25,000 × 1.08³ = ₹31,492.80
    expect(compoundMonthly(toPaise(25_000), 8, 36)).toBe(toPaise(31_492.8))
  })

  it('is a no-op at zero rate or zero months', () => {
    expect(compoundMonthly(toPaise(25_000), 0, 36)).toBe(toPaise(25_000))
    expect(compoundMonthly(toPaise(25_000), 8, 0)).toBe(toPaise(25_000))
  })
})
