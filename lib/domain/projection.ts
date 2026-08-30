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

import { loanEMI } from './loan'
import { addMonths, compareMonth, monthOfDate, monthsBetween } from './month'
import { scale } from './money'
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

/** Cash a goal takes out of the balance at funding time. */
export function goalCashRequired(goal: Goal): Paise {
  if (goal.funding === 'savings') return goal.targetAmount
  return Math.min(goal.downPayment ?? 0, goal.targetAmount)
}

function loanForGoal(goal: Goal, fundedMonth: ISOMonth): Loan | null {
  if (goal.funding === 'savings' || !goal.loanTerms) return null
  const principal = goal.targetAmount - goalCashRequired(goal)
  if (principal <= 0) return null
  return {
    id: `goal-loan:${goal.id}`,
    name: goal.name,
    principal,
    annualRatePct: goal.loanTerms.annualRatePct,
    tenureMonths: goal.loanTerms.tenureMonths,
    // The first EMI falls the month after the purchase.
    startMonth: addMonths(fundedMonth, 1),
    goalId: goal.id,
  }
}

export function project(doc: BudgetDoc): Projection {
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

  for (let i = 0; i < horizonMonths; i++) {
    const month = addMonths(origin.month, i)
    const resolved = resolveMonth(doc, month, loans)

    const oneOffs = doc.oneOffs.filter((o) => o.month === month)
    const oneOffNet = oneOffs.reduce(
      (acc, o) => acc + (o.direction === 'in' ? o.amount : -o.amount),
      0,
    )

    const surplus = resolved.surplus + oneOffNet
    const openingBalance = balance
    balance += surplus

    // Returns accrue on money you actually have.
    const returns = balance > 0 ? scale(balance, monthlyReturn) : 0
    balance += returns

    const floor = safetyFloorFor(doc.settings.safetyFloor, resolved)
    const goalsFunded: FundedGoalRef[] = []

    for (const goal of activeGoals) {
      if (!pending.has(goal.id)) continue
      // A goal is never tested before its target month.
      if (compareMonth(goal.targetMonth, month) > 0) continue

      const cashOut = goalCashRequired(goal)
      if (balance - floor < cashOut) continue

      balance -= cashOut
      pending.delete(goal.id)
      fundedAt.set(goal.id, month)
      goalsFunded.push({
        goalId: goal.id,
        name: goal.name,
        emoji: goal.emoji,
        cashOut,
      })

      const loan = loanForGoal(goal, month)
      if (loan) loans.push(loan)
    }

    months.push({
      month,
      income: resolved.income,
      expenses: resolved.expenses,
      emis: resolved.emis,
      surplus,
      openingBalance,
      closingBalance: balance,
      returns,
      floor,
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

/** Total monthly EMI burden in a given month, for display. */
export function emiBurden(loans: Loan[]): Paise {
  return loans.reduce((acc, loan) => acc + loanEMI(loan), 0)
}
