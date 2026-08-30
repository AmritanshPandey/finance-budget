/**
 * Month arithmetic. Months are "YYYY-MM" strings; all maths goes through a
 * simple integer index so there is never a Date object (and never a timezone)
 * involved in the forecast.
 */

import type { ISOMonth } from './types'

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export function isValidMonth(m: string): m is ISOMonth {
  return MONTH_RE.test(m)
}

/** year * 12 + (month - 1) */
export function toMonthIndex(m: ISOMonth): number {
  const year = Number(m.slice(0, 4))
  const month = Number(m.slice(5, 7))
  return year * 12 + (month - 1)
}

export function fromMonthIndex(index: number): ISOMonth {
  const year = Math.floor(index / 12)
  const month = index - year * 12 + 1
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
}

export function addMonths(m: ISOMonth, n: number): ISOMonth {
  return fromMonthIndex(toMonthIndex(m) + n)
}

/** Positive when `b` is later than `a`. */
export function monthsBetween(a: ISOMonth, b: ISOMonth): number {
  return toMonthIndex(b) - toMonthIndex(a)
}

export function compareMonth(a: ISOMonth, b: ISOMonth): number {
  return toMonthIndex(a) - toMonthIndex(b)
}

export function minMonth(a: ISOMonth, b: ISOMonth): ISOMonth {
  return compareMonth(a, b) <= 0 ? a : b
}

export function maxMonth(a: ISOMonth, b: ISOMonth): ISOMonth {
  return compareMonth(a, b) >= 0 ? a : b
}

export function monthRange(start: ISOMonth, count: number): ISOMonth[] {
  const out: ISOMonth[] = []
  for (let i = 0; i < count; i++) out.push(addMonths(start, i))
  return out
}

export function currentMonth(now: Date = new Date()): ISOMonth {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function monthOfDate(date: string): ISOMonth {
  return date.slice(0, 7)
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** "Aug 2026" */
export function formatMonthLabel(m: ISOMonth): string {
  return `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
}

/** "Aug" */
export function formatMonthShort(m: ISOMonth): string {
  return MONTH_NAMES[Number(m.slice(5, 7)) - 1]
}

export function isJanuary(m: ISOMonth): boolean {
  return m.slice(5, 7) === '01'
}

/**
 * "4 months late", "1 month early" — plain language, never a signed number in
 * the interface.
 */
export function formatMonthDelta(months: number): string {
  const n = Math.abs(months)
  const unit = n === 1 ? 'month' : 'months'
  if (months === 0) return 'on time'
  if (months > 0) return `${n} ${unit} late`
  return `${n} ${unit} early`
}
