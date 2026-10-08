import { validDate, type Filters } from './financialModel';

export type FinancialDetailConcept = 'revenue' | 'expense' | 'result' | 'personal' | 'laundry' | 'supplies' | 'products' | 'other' | 'cleaning' | 'services' | 'supplements' | 'cloth' | `external:${string}`;
export function validDetailConcept(value: unknown): value is FinancialDetailConcept {
  return typeof value === 'string' && (['revenue', 'expense', 'result', 'personal', 'laundry', 'supplies', 'products', 'other', 'cleaning', 'services', 'supplements', 'cloth'].includes(value) || value.startsWith('external:') && value.slice(9).trim().length > 0);
}
export interface FinancialDrilldown { concept: FinancialDetailConcept; returnFilters: Filters; monthly: boolean; origin?: 'comparison' }
export interface FinancialView {
  filters: Filters;
  tab: 'general' | 'clients' | 'properties' | 'services' | 'expenses' | 'rates' | 'incomes' | 'details';
  profitFilter: 'all' | 'negative' | 'low';
  drilldown?: FinancialDrilldown;
  monthlyPeriod?: Pick<Filters, 'start' | 'end'>;
  annualComparison?: 'balance' | 'costs' | 'incomes';
  allocation?: 'none' | 'revenue' | 'services';
  comparison?: 'previous' | 'year' | 'budget';
  budgetId?: string;
  alerts?: { margin: number; days: number; zero: boolean };
}
const tabs = ['general', 'clients', 'properties', 'services', 'expenses', 'rates', 'incomes', 'details'];
const profits = ['all', 'negative', 'low'];
function validFilters(value: Filters | undefined) {
  return !!value && validDate(value.start) && validDate(value.end) && value.start <= value.end &&
    ['clients', 'properties', 'workers'].every(key => Array.isArray(value[key]) && value[key].every((id: unknown) => typeof id === 'string')) &&
    ['buildings', 'types', 'categories', 'propertyScope'].every(key => value[key] === undefined || Array.isArray(value[key]) && value[key].every((id: unknown) => typeof id === 'string')) &&
    (!value.categories || value.categories.every(category => ['personal', 'laundry', 'supplies', 'products', 'salary', 'other'].includes(category)));
}

export function financialYearRange(year: string): Pick<Filters, 'start' | 'end'> | null {
  const start = `${year}-01-01`, end = `${year}-12-31`;
  return /^\d{4}$/.test(year) && Number(year) > 0 && validDate(start) && validDate(end) ? { start, end } : null;
}
export function selectedFinancialYear(filters: Pick<Filters, 'start' | 'end'>): string {
  const year = filters.start.slice(0, 4), range = financialYearRange(year);
  return range?.start === filters.start && range.end === filters.end ? year : '';
}

export function financialMonthRange(month: string): Pick<Filters, 'start' | 'end'> | null {
  if (!/^\d{4}-\d{2}$/.test(month) || !validDate(`${month}-01`)) return null;
  const start = `${month}-01`;
  const end = new Date(`${start}T00:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return { start, end: end.toISOString().slice(0, 10) };
}
export function selectedFinancialMonth(filters: Pick<Filters, 'start' | 'end'>): string {
  const month = filters.start.slice(0, 7);
  const range = financialMonthRange(month);
  return range?.start === filters.start && range.end === filters.end ? month : '';
}
// Only presentation choices, scoped by account and site in this browser tab.
// Shared financial settings and unsaved business adjustments are not stored here.
export function loadFinancialView(ownerKey: string, today: string): FinancialView {
  const fallback: FinancialView = { filters: { start: `${today.slice(0, 7)}-01`, end: today, clients: [], properties: [], workers: [] }, tab: 'general', profitFilter: 'all' };
  try {
    const value = JSON.parse(sessionStorage.getItem(`${ownerKey}:view`) || 'null') as FinancialView | null;
    if (!value || !validFilters(value.filters) || !tabs.includes(value.tab) || !profits.includes(value.profitFilter) ||
      value.tab === 'details' && !value.drilldown || value.drilldown && (!validDetailConcept(value.drilldown.concept) || !validFilters(value.drilldown.returnFilters) || typeof value.drilldown.monthly !== 'boolean' || value.drilldown.origin !== undefined && value.drilldown.origin !== 'comparison') ||
      value.monthlyPeriod !== undefined && (!value.monthlyPeriod || !validDate(value.monthlyPeriod.start) || !validDate(value.monthlyPeriod.end) || value.monthlyPeriod.start > value.monthlyPeriod.end) ||
      value.annualComparison !== undefined && !['balance', 'costs', 'incomes'].includes(value.annualComparison) ||
      value.allocation !== undefined && !['none', 'revenue', 'services'].includes(value.allocation) ||
      value.comparison !== undefined && !['previous', 'year', 'budget'].includes(value.comparison) ||
      value.budgetId !== undefined && typeof value.budgetId !== 'string' ||
      value.alerts !== undefined && (!value.alerts || !Number.isFinite(value.alerts.margin) || value.alerts.margin < -100 || value.alerts.margin > 100 || !Number.isInteger(value.alerts.days) || value.alerts.days < 0 || value.alerts.days > 3650 || typeof value.alerts.zero !== 'boolean')) return fallback;
    return value;
  } catch { return fallback; }
}
export function saveFinancialView(ownerKey: string, view: FinancialView): void {
  try { sessionStorage.setItem(`${ownerKey}:view`, JSON.stringify(view)); } catch { /* Keep the active view when browser storage is unavailable. */ }
}
