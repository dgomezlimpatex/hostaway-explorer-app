import { financialAlerts, type AlertRules } from './financialAnalytics';
import type { FinancialAnalysis } from './financialCharts';

export type ReviewKind = 'low' | 'pending' | 'excluded' | 'clients';
export const LOW_SERVICE_MARGIN = 10;

// Everything that needs a person's attention, in one place. Amounts and
// pending flags come from the analysis; only the grouping happens here.
export function reviewLists(result: FinancialAnalysis, rules: AlertRules, today: string) {
  const alerts = financialAlerts(result, rules, today);
  const ages = new Map(alerts.pending.map(row => [row.id, row.age]));
  const low = result.services.filter(service => service.revenue! > 0 && (service.result ?? 0) / service.revenue! < LOW_SERVICE_MARGIN / 100);
  const pendingServices = result.services.filter(service => service.pending.length).map(service => ({ service, age: ages.get(service.id) ?? null }));
  const pendingIncomes = result.incomes.filter(income => income.pending.length).map(income => ({ income, age: ages.get(income.id) ?? null }));
  // A zero-revenue service is only listed while its warning is switched on; an unknown price always is.
  const excluded = result.excludedIncomeServices.filter(service => service.revenue === null || rules.zero);
  return {
    low, pendingServices, pendingIncomes, excluded, clients: alerts.clients,
    zero: excluded.filter(service => service.revenue === 0).length, unpriced: excluded.filter(service => service.revenue === null).length, old: alerts.pending.length,
    counts: { low: low.length, pending: pendingServices.length + pendingIncomes.length, excluded: excluded.length, clients: alerts.clients.length } as Record<ReviewKind, number>,
  };
}
// The first list with something in it, so the section opens on what matters.
export function firstReviewKind(counts: Record<ReviewKind, number>): ReviewKind {
  return (['low', 'pending', 'excluded', 'clients'] as const).find(kind => counts[kind] > 0) ?? 'low';
}
