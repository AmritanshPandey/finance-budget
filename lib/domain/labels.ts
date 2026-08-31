/**
 * Headings the user can rename.
 *
 * Every screen title and section heading has a stable key and a default. An
 * override is stored on the document, so renaming survives a reload and travels
 * with an export.
 */

export const DEFAULT_LABELS: Record<string, string> = {
  'overview.title': 'Financial health',
  'overview.bills': 'Bills due soon',
  'overview.goal': 'Top goal',
  'overview.recent': 'Recent spending',
  'budget.title': 'Budget',
  'budget.coming': 'What’s coming',
  'analytics.title': 'Trends',
  'analytics.spending': 'Overall spending',
  'analytics.allocation': 'Where it goes',
  'analytics.investments': 'Investments',
  'analytics.loans': 'Loans',
  'analytics.savings': 'What you keep',
  'goals.title': 'Goals',
  'goals.timeline': 'What happens next',
  'setup.title': 'Setup',
}

export function labelFor(
  labels: Record<string, string> | undefined,
  key: string,
): string {
  return labels?.[key] ?? DEFAULT_LABELS[key] ?? key
}
