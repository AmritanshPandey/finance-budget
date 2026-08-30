/**
 * Money is integer paise everywhere. Formatting is Indian — ₹20,00,000 and
 * ₹20L — because Western digit grouping reads as wrong in this context.
 */

import type { Paise } from './types'

export const RUPEE = '₹'

export function toPaise(rupees: number): Paise {
  return Math.round(rupees * 100)
}

export function toRupees(paise: Paise): number {
  return paise / 100
}

export function sum(values: Paise[]): Paise {
  let total = 0
  for (const v of values) total += v
  return total
}

/** Multiply by a rate, rounding to whole paise. */
export function scale(paise: Paise, rate: number): Paise {
  return Math.round(paise * rate)
}

/** Compound `paise` at `annualRatePct` for `months` months. */
export function compoundMonthly(
  paise: Paise,
  annualRatePct: number,
  months: number,
): Paise {
  if (!annualRatePct || months <= 0) return paise
  return Math.round(paise * Math.pow(1 + annualRatePct / 100, months / 12))
}

const inrGrouping = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
})

/** "₹20,00,000" */
export function formatINR(paise: Paise, opts?: { sign?: boolean }): string {
  const negative = paise < 0
  const rupees = Math.round(Math.abs(paise) / 100)
  const body = `${RUPEE}${inrGrouping.format(rupees)}`
  if (negative) return `-${body}`
  if (opts?.sign && paise > 0) return `+${body}`
  return body
}

const LAKH = 100_000
const CRORE = 10_000_000

/**
 * "₹45,000" · "₹20L" · "₹1.2Cr" — for dense places like timeline bars.
 */
export function formatCompactINR(paise: Paise): string {
  const negative = paise < 0
  const rupees = Math.abs(paise) / 100
  let body: string

  if (rupees >= CRORE) {
    body = `${RUPEE}${trimZero(rupees / CRORE)}Cr`
  } else if (rupees >= LAKH) {
    body = `${RUPEE}${trimZero(rupees / LAKH)}L`
  } else {
    body = `${RUPEE}${inrGrouping.format(Math.round(rupees))}`
  }
  return negative ? `-${body}` : body
}

function trimZero(n: number): string {
  const fixed = n >= 10 ? n.toFixed(0) : n.toFixed(1)
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed
}

/**
 * Parse fast-entry input. Accepts "20000", "20,000", "₹20,000", "20k", "20L",
 * "1.2cr". Returns null when there is no number in there at all.
 */
export function parseAmount(input: string): Paise | null {
  const cleaned = input.trim().replace(/[₹,\s]/g, '').toLowerCase()
  if (!cleaned) return null

  const match = cleaned.match(/^(-?\d*\.?\d+)(k|l|lakh|lac|cr|crore)?$/)
  if (!match) return null

  const value = Number(match[1])
  if (!Number.isFinite(value)) return null

  switch (match[2]) {
    case 'k':
      return toPaise(value * 1_000)
    case 'l':
    case 'lakh':
    case 'lac':
      return toPaise(value * LAKH)
    case 'cr':
    case 'crore':
      return toPaise(value * CRORE)
    default:
      return toPaise(value)
  }
}

/** The value shown in an editable field: plain rupees, no symbol. */
export function toEditableString(paise: Paise): string {
  const rupees = paise / 100
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2)
}
