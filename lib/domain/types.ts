/**
 * Core domain types.
 *
 * Money is always integer paise. Never floats — a rupee is 100 paise and every
 * amount in the system is stored, summed and compared in minor units.
 */

export type ISOMonth = string // "2026-08"
export type ISODate = string // "2026-08-30"
export type Paise = number // integer minor units

export type LineKind = 'income' | 'expense'

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

export interface CategoryGroup {
  id: string
  name: string
  order: number
  archivedAt?: ISODate
}

export interface Category {
  id: string
  groupId: string
  name: string
  kind: LineKind
  order: number
  /** Global inflation applies to this category in the forecast. */
  inflatable: boolean
  /** Archived, never deleted — historical months must still resolve it. */
  archivedAt?: ISODate
}

/**
 * A template line carries its own history. A "life event" IS a version entry
 * with a label — one mechanism rendered two ways: a value in the Month view,
 * a pin on the Future timeline.
 */
export interface TemplateLineVersion {
  from: ISOMonth
  amount: Paise
  /** Per-line growth (e.g. rent +8%/yr). Overrides the global inflation rate. */
  growthRatePct?: number
  /** Shown as an event pin on the timeline, e.g. "Promotion". */
  label?: string
}

export interface TemplateLine {
  id: string
  categoryId: string
  versions: TemplateLineVersion[]
}

/** A "just this month" edit. */
export interface MonthOverride {
  month: ISOMonth
  lineId: string
  amount: Paise
}

/**
 * Frozen once a month is past. Stores the category name alongside the id so a
 * 2026 month still reads correctly after the category is renamed or archived.
 */
export interface MonthSnapshot {
  month: ISOMonth
  frozenAt: ISODate
  lines: Array<{
    categoryId: string
    categoryName: string
    amount: Paise
    kind: LineKind
  }>
}

// ---------------------------------------------------------------------------
// Future
// ---------------------------------------------------------------------------

export interface Loan {
  id: string
  name: string
  principal: Paise
  annualRatePct: number
  tenureMonths: number
  startMonth: ISOMonth
  /** Set when the loan was created to fund a goal. */
  goalId?: string
}

export type GoalFunding = 'savings' | 'loan' | 'mixed'
export type GoalStatus = 'active' | 'achieved' | 'archived'

export interface Goal {
  id: string
  name: string
  emoji?: string
  targetAmount: Paise
  targetMonth: ISOMonth
  /** Drag order. Lower is funded first. */
  priority: number
  funding: GoalFunding
  /** Cash paid at funding time when loan/mixed. */
  downPayment?: Paise
  loanTerms?: { annualRatePct: number; tenureMonths: number }
  /** Free text, e.g. "$40,000 @ ₹88". No FX engine. */
  conversionNote?: string
  status: GoalStatus
}

export interface OneOff {
  id: string
  month: ISOMonth
  amount: Paise
  direction: 'in' | 'out'
  label: string
}

export interface BalanceCheck {
  id: string
  date: ISODate
  actualBalance: Paise
  rebaselined: boolean
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type SafetyFloor =
  | { mode: 'fixed'; amount: Paise }
  | { mode: 'monthsOfExpenses'; months: number }

export interface Settings {
  startMonth: ISOMonth
  startingBalance: Paise
  monthlySavingTarget: Paise
  safetyFloor: SafetyFloor
  /** Applied each year to everyday spending. */
  inflationRatePct: number
  /** Applied each year to income. Without it a ten-year forecast is
   *  systematically pessimistic: costs rise and pay never does. */
  incomeGrowthRatePct: number
  expectedAnnualReturnPct: number
  horizonMonths: number
  defaultViewMonths: number
}

// ---------------------------------------------------------------------------
// The whole document
// ---------------------------------------------------------------------------

export interface BudgetDoc {
  version: 1
  settings: Settings
  groups: CategoryGroup[]
  categories: Category[]
  templateLines: TemplateLine[]
  overrides: MonthOverride[]
  snapshots: MonthSnapshot[]
  loans: Loan[]
  goals: Goal[]
  oneOffs: OneOff[]
  balanceChecks: BalanceCheck[]
  onboardedAt?: ISODate
}

// ---------------------------------------------------------------------------
// Engine output
// ---------------------------------------------------------------------------

export interface ResolvedLine {
  lineId: string
  categoryId: string
  categoryName: string
  groupId: string
  kind: LineKind
  amount: Paise
  /** Derived from a loan — read-only in the Month view. */
  loanId?: string
  /** Loan lines report when the EMI stream ends. */
  endsMonth?: ISOMonth
  /** True when a "just this month" override is in effect. */
  overridden?: boolean
  /** Event label from the template version in force. */
  label?: string
}

export interface ResolvedMonth {
  month: ISOMonth
  frozen: boolean
  lines: ResolvedLine[]
  income: Paise
  expenses: Paise
  emis: Paise
  surplus: Paise
}

export interface FundedGoalRef {
  goalId: string
  name: string
  emoji?: string
  /** Cash actually taken from the balance (full amount, or the down payment). */
  cashOut: Paise
}

export interface ProjectedMonth {
  month: ISOMonth
  income: Paise
  expenses: Paise
  emis: Paise
  surplus: Paise
  openingBalance: Paise
  closingBalance: Paise
  returns: Paise
  floor: Paise
  oneOffs: OneOff[]
  events: Array<{ label: string; categoryName: string }>
  goalsFunded: FundedGoalRef[]
}

export type GoalOutcomeStatus = 'onTime' | 'late' | 'unreachable'

export interface GoalOutcome {
  goalId: string
  name: string
  emoji?: string
  targetMonth: ISOMonth
  targetAmount: Paise
  fundedMonth: ISOMonth | null
  /** Months past the target date. 0 when on time. */
  slipMonths: number
  status: GoalOutcomeStatus
}

export interface Projection {
  months: ProjectedMonth[]
  goalOutcomes: GoalOutcome[]
  /** Origin of the projection — a balance check, or the onboarding figure. */
  originMonth: ISOMonth
  originBalance: Paise
}
