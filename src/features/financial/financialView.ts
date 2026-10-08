import { validDate, type Filters } from './financialModel';

export interface FinancialView {
  filters: Filters;
  tab: 'general' | 'clients' | 'services' | 'expenses' | 'rates' | 'incomes';
  profitFilter: 'all' | 'negative' | 'low';
}
const tabs = ['general', 'clients', 'services', 'expenses', 'rates', 'incomes'];
const profits = ['all', 'negative', 'low'];

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
    if (!value?.filters || !validDate(value.filters.start) || !validDate(value.filters.end) || value.filters.start > value.filters.end || !tabs.includes(value.tab) || !profits.includes(value.profitFilter) ||
      ['clients', 'properties', 'workers'].some(key => !Array.isArray(value.filters[key]) || value.filters[key].some((id: unknown) => typeof id !== 'string'))) return fallback;
    return value;
  } catch { return fallback; }
}
export function saveFinancialView(ownerKey: string, view: FinancialView): void {
  try { sessionStorage.setItem(`${ownerKey}:view`, JSON.stringify(view)); } catch { /* Keep the active view when browser storage is unavailable. */ }
}
