import { validDate, type Filters } from './financialModel';

export interface FinancialView {
  filters: Filters;
  tab: 'general' | 'clients' | 'services' | 'expenses' | 'rates' | 'incomes';
  profitFilter: 'all' | 'negative' | 'low';
}
const tabs = ['general', 'clients', 'services', 'expenses', 'rates', 'incomes'];
const profits = ['all', 'negative', 'low'];
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
