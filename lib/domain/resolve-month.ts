/**
 * Resolving one month's lines.
 *
 * Past months are frozen snapshots and are returned verbatim — this is what
 * makes renaming, archiving or re-grouping a category safe forever. Current and
 * future months are derived from versioned template lines plus growth plus any
 * "just this month" override, with loan EMIs appended.
 */

import { LOANS_GROUP_ID, LOAN_CATEGORY_PREFIX } from './constants'
import { isLoanActive, loanEMI, loanEndMonth } from './loan'
import { compareMonth, monthOfDate, monthsBetween } from './month'
import { compoundMonthly } from './money'
import type {
  BudgetDoc,
  Category,
  ISOMonth,
  Loan,
  Paise,
  ResolvedLine,
  ResolvedMonth,
  TemplateLineVersion,
} from './types'

/** The version in force for `month`: the latest one starting at or before it. */
export function versionInForce(
  versions: TemplateLineVersion[],
  month: ISOMonth,
): TemplateLineVersion | null {
  let best: TemplateLineVersion | null = null
  for (const v of versions) {
    if (compareMonth(v.from, month) > 0) continue
    if (!best || compareMonth(v.from, best.from) > 0) best = v
  }
  return best
}

function isArchivedBy(category: Category, month: ISOMonth): boolean {
  if (!category.archivedAt) return false
  return compareMonth(monthOfDate(category.archivedAt), month) <= 0
}

function totals(lines: ResolvedLine[]) {
  let income = 0
  let expenses = 0
  let emis = 0
  let investments = 0
  for (const line of lines) {
    if (line.kind === 'income') income += line.amount
    else if (line.kind === 'investment') investments += line.amount
    else if (line.loanId) emis += line.amount
    else expenses += line.amount
  }
  // Investing is not spending, but it does leave the account this month.
  return {
    income,
    expenses,
    emis,
    investments,
    surplus: income - expenses - emis - investments,
  }
}

export function loanLineId(loanId: string): string {
  return `${LOAN_CATEGORY_PREFIX}${loanId}`
}

/** A loan called "Loan" should not read "Loan loan starts". */
export function loanStartLabel(name: string): string {
  return /loan|emi|mortgage/i.test(name) ? `${name} starts` : `${name} loan starts`
}

export function loanLine(
  loan: Loan,
  month: ISOMonth,
  override?: Paise,
): ResolvedLine {
  return {
    lineId: loanLineId(loan.id),
    categoryId: loanLineId(loan.id),
    categoryName: loan.name,
    groupId: LOANS_GROUP_ID,
    kind: 'expense',
    amount: override ?? loanEMI(loan),
    loanId: loan.id,
    endsMonth: loanEndMonth(loan),
    overridden: override !== undefined,
    label: monthsBetween(loan.startMonth, month) === 0 ? loanStartLabel(loan.name) : undefined,
  }
}

/**
 * @param loans defaults to the document's loans. The projection passes an
 *   extended list so loans created by loan-funded goals are included.
 */
export function resolveMonth(
  doc: BudgetDoc,
  month: ISOMonth,
  loans: Loan[] = doc.loans,
): ResolvedMonth {
  const snapshot = doc.snapshots.find((s) => s.month === month)
  if (snapshot) {
    const lines: ResolvedLine[] = snapshot.lines.map((line) => {
      const category = doc.categories.find((c) => c.id === line.categoryId)
      return {
        lineId: `snapshot:${line.categoryId}`,
        categoryId: line.categoryId,
        // The snapshot's own name wins — that is the point of freezing.
        categoryName: line.categoryName,
        groupId: category?.groupId ?? LOANS_GROUP_ID,
        kind: line.kind,
        amount: line.amount,
      }
    })
    return { month, frozen: true, lines, ...totals(lines) }
  }

  const lines: ResolvedLine[] = []

  for (const templateLine of doc.templateLines) {
    const category = doc.categories.find((c) => c.id === templateLine.categoryId)
    if (!category) continue
    if (isArchivedBy(category, month)) continue

    const version = versionInForce(templateLine.versions, month)
    if (!version) continue // the line does not exist yet in this month

    const growthRate =
      version.growthRatePct ??
      (category.kind === 'income'
        ? doc.settings.incomeGrowthRatePct
        : category.inflatable
          ? doc.settings.inflationRatePct
          : 0)

    let amount: Paise = compoundMonthly(
      version.amount,
      growthRate,
      monthsBetween(version.from, month),
    )

    const override = doc.overrides.find(
      (o) => o.month === month && o.lineId === templateLine.id,
    )
    if (override) amount = override.amount

    lines.push({
      lineId: templateLine.id,
      categoryId: category.id,
      categoryName: category.name,
      groupId: category.groupId,
      kind: category.kind,
      amount,
      overridden: Boolean(override),
      locked: category.locked,
      label: version.from === month ? version.label : undefined,
    })
  }

  for (const loan of loans) {
    if (!isLoanActive(loan, month)) continue
    // An EMI can be varied for one month — a prepayment, or a month skipped.
    const override = doc.overrides.find(
      (o) => o.month === month && o.lineId === loanLineId(loan.id),
    )
    lines.push(loanLine(loan, month, override?.amount))
  }

  return { month, frozen: false, lines, ...totals(lines) }
}
