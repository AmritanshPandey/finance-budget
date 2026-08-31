/**
 * Standard rates, as starting assumptions.
 *
 * Every figure here is a long-run historical average for India, rounded to
 * something a person can hold in their head. They are **assumptions, not
 * predictions** — nothing here is a forecast of what any particular investment
 * will do, and every one of them is editable per line.
 *
 * Nothing applies until the user names what something is: the default class and
 * type are both "not specified", which carries a rate of zero.
 */

export interface RatePreset {
  key: string
  label: string
  ratePct: number
  /** Shown beside the rate so the number is never bare. */
  note?: string
}

/** What kind of spending a line is, for the purpose of how its price moves. */
export const INFLATION_CLASSES: RatePreset[] = [
  { key: 'none', label: 'Stays flat', ratePct: 0, note: 'no automatic rise' },
  { key: 'general', label: 'General prices', ratePct: 6, note: 'broad CPI' },
  { key: 'food', label: 'Food and groceries', ratePct: 7 },
  { key: 'housing', label: 'Rent and housing', ratePct: 8 },
  { key: 'utilities', label: 'Utilities and fuel', ratePct: 6 },
  { key: 'transport', label: 'Transport', ratePct: 6 },
  { key: 'services', label: 'Help and services', ratePct: 8, note: 'wages rise faster than goods' },
  { key: 'lifestyle', label: 'Lifestyle and eating out', ratePct: 7 },
  { key: 'education', label: 'Education', ratePct: 10, note: 'fees outpace general prices' },
  { key: 'medical', label: 'Medical', ratePct: 12, note: 'the fastest-rising of the lot' },
]

/** What an investment is held in, for the purpose of what it returns. */
export const INVESTMENT_TYPES: RatePreset[] = [
  { key: 'none', label: 'Not specified', ratePct: 0, note: 'no growth assumed' },
  { key: 'savings', label: 'Savings account', ratePct: 3.5 },
  { key: 'rd', label: 'Recurring deposit', ratePct: 6.5 },
  { key: 'fd', label: 'Fixed deposit', ratePct: 7 },
  { key: 'debt-mf', label: 'Debt mutual fund', ratePct: 7 },
  { key: 'ppf', label: 'PPF', ratePct: 7.1, note: 'locked until maturity' },
  { key: 'gold', label: 'Gold', ratePct: 8 },
  { key: 'epf', label: 'EPF', ratePct: 8.25, note: 'locked until you leave work' },
  { key: 'hybrid-mf', label: 'Hybrid mutual fund', ratePct: 10 },
  { key: 'nps', label: 'NPS', ratePct: 10, note: 'locked until 60' },
  { key: 'equity-mf', label: 'Equity mutual fund', ratePct: 12, note: 'long-run average, not a promise' },
  { key: 'elss', label: 'ELSS', ratePct: 12, note: 'three-year lock on each instalment' },
  { key: 'index', label: 'Index fund', ratePct: 12 },
  { key: 'stocks', label: 'Direct stocks', ratePct: 12, note: 'the average hides a very wide spread' },
]

/** Types whose money genuinely cannot be reached until a life event. */
export const LOCKED_BY_DEFAULT = new Set(['ppf', 'epf', 'nps'])

function lookup(presets: RatePreset[], key: string | undefined): RatePreset {
  return presets.find((p) => p.key === key) ?? presets[0]
}

export function inflationClass(key: string | undefined): RatePreset {
  return lookup(INFLATION_CLASSES, key)
}

export function investmentType(key: string | undefined): RatePreset {
  return lookup(INVESTMENT_TYPES, key)
}

/** The return a pot compounds at, honouring a per-line override. */
export function returnRateFor(
  typeKey: string | undefined,
  overridePct: number | undefined,
): number {
  return overridePct ?? investmentType(typeKey).ratePct
}

/**
 * What something costing `amount` today would cost in `months` time. Used to
 * show a goal's real price alongside the figure the user typed.
 */
export function inflateOver(amount: number, ratePct: number, months: number): number {
  if (!ratePct || months <= 0) return amount
  return Math.round(amount * Math.pow(1 + ratePct / 100, months / 12))
}
