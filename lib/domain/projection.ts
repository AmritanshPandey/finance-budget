/**
 * The projection. One pure function that is the single source of every figure
 * rendered anywhere in the app — no component computes money on its own.
 *
 * Walk forward month by month from the origin (the last re-baselined balance
 * check, or the onboarding figure). Each month: resolve the plan, apply the
 * surplus, apply returns, then try to fund goals in priority order without ever
 * crossing the safety floor. A goal that does not fit is retried every
 * following month, and reported as late — never silently dropped.
 */

import { hasActuals, hasIncomeActuals, monthActuals } from './actuals'
import { loanEMI } from './loan'
import { addMonths, compareMonth, currentMonth, monthOfDate, monthsBetween } from './month'
import { scale } from './money'
import { inflateOver, inflationClass, returnRateFor } from './rates'
import { resolveMonth } from './resolve-month'
import type {
  BudgetDoc,
  FundedGoalRef,
  Goal,
  GoalOutcome,
  ISOMonth,
  Loan,
  Paise,
  ProjectedMonth,
  Projection,
  ResolvedMonth,
  SafetyFloor,
} from './types'

export function safetyFloorFor(floor: SafetyFloor, month: ResolvedMonth): Paise {
  if (floor.mode === 'fixed') return floor.amount
  return Math.round((month.expenses + month.emis) * floor.months)
}

/** The origin of the forecast: the most recent re-baselined balance check. */
export function projectionOrigin(doc: BudgetDoc): {
  month: ISOMonth
  balance: Paise
} {
  const rebaselines = doc.balanceChecks
    .filter((c) => c.rebaselined)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const latest = rebaselines[rebaselines.length - 1]
  if (latest) {
    return { month: monthOfDate(latest.date), balance: latest.actualBalance }
  }
  return { month: doc.settings.startMonth, balance: doc.settings.startingBalance }
}

/**
 * What a goal will actually cost by the time it lands.
 *
 * An amount given in today's money is inflated at its own class rate — a
 * ₹20,00,000 degree three years out does not stay ₹20,00,000 while education
 * costs climb. An amount given as a future price is taken literally.
 */
export function goalRequiredAmount(goal: Goal, originMonth: ISOMonth): Paise {
  if (goal.amountIn === 'future') return goal.targetAmount
  const rate = inflationClass(goal.inflationClass).ratePct
  return inflateOver(goal.targetAmount, rate, monthsBetween(originMonth, goal.targetMonth))
}

/** Cash a goal takes out of the balance at funding time. */
export function goalCashRequired(goal: Goal, originMonth: ISOMonth): Paise {
  const required = goalRequiredAmount(goal, originMonth)
  if (goal.funding === 'savings') return required
  // The deposit keeps its proportion as the price moves.
  const factor = goal.targetAmount > 0 ? required / goal.targetAmount : 1
  return Math.min(Math.round((goal.downPayment ?? 0) * factor), required)
}

function loanForGoal(goal: Goal, fundedMonth: ISOMonth, originMonth: ISOMonth): Loan | null {
  if (goal.funding === 'savings' || !goal.loanTerms) return null
  const principal = goalRequiredAmount(goal, originMonth) - goalCashRequired(goal, originMonth)
  if (principal <= 0) return null
  return {
    id: `goal-loan:${goal.id}`,
    name: goal.name,
    spec: {
      mode: 'principal',
      principal,
      annualRatePct: goal.loanTerms.annualRatePct,
    },
    tenureMonths: goal.loanTerms.tenureMonths,
    // The first EMI falls the month after the purchase.
    startMonth: addMonths(fundedMonth, 1),
    goalId: goal.id,
  }
}

/**
 * @param opts.now the month treated as "this month". Months strictly before it
 *   are driven by real transactions where any exist; this month and every month
 *   after are driven by the plan, because this month is not over yet.
 */
export function project(doc: BudgetDoc, opts?: { now?: ISOMonth }): Projection {
  const now = opts?.now ?? currentMonth()
  const origin = projectionOrigin(doc)
  const { horizonMonths, expectedAnnualReturnPct } = doc.settings
  const monthlyReturn = expectedAnnualReturnPct / 12 / 100

  const activeGoals = doc.goals
    .filter((g) => g.status === 'active')
    .sort((a, b) => a.priority - b.priority)

  const pending = new Map<string, Goal>(activeGoals.map((g) => [g.id, g]))
  const fundedAt = new Map<string, ISOMonth>()

  // Loans grow during the walk: a loan-funded goal starts its EMI stream the
  // month after it lands.
  const loans: Loan[] = [...doc.loans]

  const months: ProjectedMonth[] = []
  let balance = origin.balance
  // Investments are money too. They leave the monthly account but accumulate,
  // and the locked pot is wealth that goals are never allowed to spend.
  /**
   * One pot per investment category, each compounding at the rate its
   * instrument implies. A fixed deposit and an equity fund do not grow at the
   * same speed, and averaging them into a single number hides the difference
   * that matters most over ten years.
   */
  const pots = new Map<string, Paise>()
  const contributed = new Map<string, Paise>()

  const rateFor = (categoryId: string) => {
    const category = doc.categories.find((c) => c.id === categoryId)
    return returnRateFor(category?.investmentType, category?.returnRatePctOverride) / 12 / 100
  }
  const isLocked = (categoryId: string) =>
    Boolean(doc.categories.find((c) => c.id === categoryId)?.locked)
  const add = (map: Map<string, Paise>, key: string, amount: Paise) =>
    map.set(key, (map.get(key) ?? 0) + amount)

  for (let i = 0; i < horizonMonths; i++) {
    const month = addMonths(origin.month, i)
    const resolved = resolveMonth(doc, month, loans)

    const oneOffs = doc.oneOffs.filter((o) => o.month === month)
    const oneOffNet = oneOffs.reduce(
      (acc, o) => acc + (o.direction === 'in' ? o.amount : -o.amount),
      0,
    )

    // resolved.surplus has already had investment contributions taken out.
    // A month that has ended and has transactions is reported, not predicted.
    const settled = compareMonth(month, now) < 0 && hasActuals(doc, month)
    const actual = settled ? monthActuals(doc, month) : null

    let income = resolved.income
    let expenses = resolved.expenses + resolved.emis
    let contributedAvailable = 0
    let contributedLocked = 0
    let lumpAvailable = 0
    let lumpLocked = 0
    /** Everything joining a pot this month, by category. */
    const intoPots = new Map<string, Paise>()

    // A planned lump sum into an investment leaves cash but joins a pot.
    for (const oneOff of oneOffs) {
      if (oneOff.direction !== 'out' || !oneOff.investIntoCategoryId) continue
      const category = doc.categories.find((c) => c.id === oneOff.investIntoCategoryId)
      if (!category || category.kind !== 'investment') continue
      add(intoPots, category.id, oneOff.amount)
      if (category.locked) lumpLocked += oneOff.amount
      else lumpAvailable += oneOff.amount
    }

    if (actual) {
      // Income falls back to the plan unless income was logged too — otherwise
      // a month where only spending was recorded would look catastrophic.
      income = hasIncomeActuals(doc, month) ? actual.received : resolved.income
      expenses = actual.spent
      contributedAvailable = actual.investedAvailable
      contributedLocked = actual.investedLocked
      for (const [categoryId, amount] of actual.byCategory) {
        if (doc.categories.find((c) => c.id === categoryId)?.kind === 'investment') {
          add(intoPots, categoryId, amount)
        }
      }
    } else {
      for (const line of resolved.lines) {
        if (line.kind !== 'investment') continue
        add(intoPots, line.categoryId, line.amount)
        if (line.locked) contributedLocked += line.amount
        else contributedAvailable += line.amount
      }
    }

    const surplus =
      income - expenses - contributedAvailable - contributedLocked + oneOffNet
    const openingBalance = balance
    balance += surplus

    // Returns accrue on money you actually have.
    const cashReturns = balance > 0 ? scale(balance, monthlyReturn) : 0
    balance += cashReturns

    for (const [categoryId, amount] of intoPots) {
      add(pots, categoryId, amount)
      add(contributed, categoryId, amount)
    }

    let potReturns = 0
    for (const [categoryId, value] of pots) {
      const growth = scale(value, rateFor(categoryId))
      potReturns += growth
      pots.set(categoryId, value + growth)
    }

    let investedAvailable = 0
    let investedLocked = 0
    for (const [categoryId, value] of pots) {
      if (isLocked(categoryId)) investedLocked += value
      else investedAvailable += value
    }

    const floor = safetyFloorFor(doc.settings.safetyFloor, resolved)
    const goalsFunded: FundedGoalRef[] = []

    for (const goal of activeGoals) {
      if (!pending.has(goal.id)) continue
      // A goal is never tested before its target month.
      if (compareMonth(goal.targetMonth, month) > 0) continue

      const cashOut = goalCashRequired(goal, origin.month)
      // Cash first, then investments you are actually allowed to touch.
      if (balance + investedAvailable - floor < cashOut) continue

      const fromCash = Math.min(balance, cashOut)
      balance -= fromCash

      // Then sell down the pots goals are allowed to touch, in order.
      let owed = cashOut - fromCash
      for (const [categoryId, value] of pots) {
        if (owed <= 0) break
        if (isLocked(categoryId)) continue
        const taken = Math.min(value, owed)
        pots.set(categoryId, value - taken)
        investedAvailable -= taken
        owed -= taken
      }

      pending.delete(goal.id)
      fundedAt.set(goal.id, month)
      goalsFunded.push({
        goalId: goal.id,
        name: goal.name,
        emoji: goal.emoji,
        cashOut,
      })

      const loan = loanForGoal(goal, month, origin.month)
      if (loan) loans.push(loan)
    }

    months.push({
      month,
      settled: Boolean(actual),
      income,
      expenses: actual ? actual.spent : resolved.expenses,
      emis: actual ? 0 : resolved.emis,
      investments: contributedAvailable + contributedLocked + lumpAvailable + lumpLocked,
      surplus,
      openingBalance,
      closingBalance: balance,
      returns: cashReturns + potReturns,
      floor,
      investedAvailable,
      investedLocked,
      pots: Object.fromEntries(pots),
      contributed: Object.fromEntries(contributed),
      netWorth: balance + investedAvailable + investedLocked,
      oneOffs,
      events: resolved.lines
        .filter((l) => l.label)
        .map((l) => ({ label: l.label as string, categoryName: l.categoryName })),
      goalsFunded,
    })
  }

  const goalOutcomes: GoalOutcome[] = activeGoals.map((goal) => {
    const funded = fundedAt.get(goal.id) ?? null
    const slipMonths = funded ? Math.max(0, monthsBetween(goal.targetMonth, funded)) : 0
    return {
      goalId: goal.id,
      name: goal.name,
      emoji: goal.emoji,
      targetMonth: goal.targetMonth,
      targetAmount: goal.targetAmount,
      requiredAmount: goalRequiredAmount(goal, origin.month),
      fundedMonth: funded,
      slipMonths,
      status: !funded ? 'unreachable' : slipMonths > 0 ? 'late' : 'onTime',
    }
  })

  return {
    months,
    goalOutcomes,
    originMonth: origin.month,
    originBalance: origin.balance,
  }
}

/** Look up one projected month. */
export function projectedMonth(
  projection: Projection,
  month: ISOMonth,
): ProjectedMonth | undefined {
  return projection.months.find((m) => m.month === month)
}

/** Total monthly EMI burden, for display. */
export function emiBurden(loans: Loan[]): Paise {
  return loans.reduce((acc, loan) => acc + loanEMI(loan), 0)
}
