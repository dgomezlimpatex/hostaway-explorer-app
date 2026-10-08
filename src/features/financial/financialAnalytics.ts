import { analyze, validDate, type Category, type Expense, type Filters, type FinanceSettings, type FinancialService, type Summary } from './financialModel';
import type { FinancialAnalysis } from './financialCharts';
import type { DirectoryEntry } from './financialSource';

export type Allocation = 'none' | 'revenue' | 'services';
const categories: Category[] = ['personal', 'laundry', 'supplies', 'products', 'salary', 'other'];
export const cleaningService = (type: string) => /^(limpieza|cleaning)/i.test(type.trim());
export function scopeBuildings(filters: Filters, buildings: { id: string; propertyIds: string[] }[]): Filters {
  if (!filters.buildings?.length) return filters;
  return { ...filters, propertyScope: [...new Set(buildings.filter(group => filters.buildings!.includes(group.id)).flatMap(group => group.propertyIds))] };
}
// Largest remainder in integer cents, with stable IDs for ties. Never lose or
// duplicate a cent when sharing one monthly overhead across several services.
export function distributeCents(cents: number, rows: { id: string; weight: number }[]) {
  const eligible = rows.filter(row => row.weight > 0).sort((a, b) => a.id.localeCompare(b.id));
  const denominator = eligible.reduce((sum, row) => sum + BigInt(row.weight), 0n);
  if (!denominator) return new Map<string, number>();
  const parts = eligible.map(row => { const numerator = BigInt(cents) * BigInt(row.weight); return { id: row.id, cents: Number(numerator / denominator), remainder: numerator % denominator }; });
  let remaining = cents - parts.reduce((sum, row) => sum + row.cents, 0);
  for (const row of [...parts].sort((a, b) => a.remainder === b.remainder ? a.id.localeCompare(b.id) : a.remainder > b.remainder ? -1 : 1)) {
    if (!remaining) break;
    row.cents++; remaining--;
  }
  return new Map(parts.map(row => [row.id, row.cents]));
}
function expenseDelta(summary: Summary, removed: Expense[], added: Expense[]): Summary {
  const costs = { ...summary.costs };
  for (const row of removed) costs[row.category] -= row.cents;
  for (const row of added) costs[row.category] += row.cents;
  const expense = categories.reduce((sum, category) => sum + costs[category], 0), result = summary.revenue - expense;
  return { ...summary, costs, expense, result, margin: summary.revenue ? result / summary.revenue * 100 : null };
}
export function analyzeWithAllocation(services: FinancialService[], settings: FinanceSettings, filters: Filters, mode: Allocation) {
  const selected = analyze(services, settings, filters);
  if (mode === 'none') return { ...selected, allocation: { mode, assigned: 0, remaining: selected.general.expense } };
  // The denominator is site-wide and calculated before client, property,
  // building or worker filters. Filtering cannot allocate the entire salary
  // anew to each client. Only completely unlinked overhead is redistributed.
  const full = analyze(services, settings, { ...filters, clients: [], properties: [], workers: [], buildings: [], propertyScope: undefined });
  const eligible = [...full.services, ...full.incomes].filter(row => row.clientId && (row.revenue || 0) > 0);
  const serviceIds = new Set(full.services.map(row => row.id));
  const selectedIds = new Set([...selected.services, ...selected.incomes].map(row => row.id));
  const removedIds = new Set<string>(), additions: Expense[] = [];
  for (const expense of full.expenses.filter(row => !row.clientId && !row.propertyId && !row.workerId)) {
    const monthRows = eligible.filter(row => row.date.slice(0, 7) === expense.date.slice(0, 7));
    const portions = distributeCents(expense.cents, monthRows.map(row => ({ id: row.id, weight: mode === 'revenue' ? row.revenue || 0 : serviceIds.has(row.id) ? 1 : 0 })));
    if (!portions.size) continue;
    removedIds.add(expense.id);
    for (const row of monthRows) {
      const cents = portions.get(row.id) || 0;
      if (!cents || !selectedIds.has(row.id)) continue;
      additions.push({ ...expense, id: `allocation:${expense.id}:${row.id}`, date: row.date, cents,
        label: `Reparto · ${expense.label} · ${row.propertyName}`, clientId: row.clientId, propertyId: row.propertyId });
    }
  }
  const removed = selected.expenses.filter(row => removedIds.has(row.id)), expenses = [...selected.expenses.filter(row => !removedIds.has(row.id)), ...additions];
  return { ...selected, expenses, total: expenseDelta(selected.total, removed, additions),
    clients: selected.clients.map(row => ({ ...row, ...expenseDelta(row, [], additions.filter(expense => expense.clientId === row.id)) })),
    general: expenseDelta(selected.general, removed, []), allocation: { mode, assigned: additions.reduce((sum, row) => sum + row.cents, 0), remaining: expenseDelta(selected.general, removed, []).expense } };
}
export interface PropertyResult extends Summary { id: string; name: string; clientIds: string[]; cleanings: number; allocated: number }
export function propertyResults(result: FinancialAnalysis, directory: DirectoryEntry[]): PropertyResult[] {
  const rows = new Map<string, PropertyResult>();
  const serviceIds = new Set(result.services.map(row => row.id)), names = new Map(directory.map(row => [row.id, row.name]));
  const ensure = (id: string, name = '') => {
    const row = rows.get(id) || { id, name: names.get(id) || name || 'Propiedad sin identificar', clientIds: [], cleanings: 0, allocated: 0,
      revenue: 0, costs: Object.fromEntries(categories.map(category => [category, 0])) as Record<Category, number>, expense: 0, result: 0, margin: null, pending: 0, estimated: 0, services: 0 };
    rows.set(id, row); return row;
  };
  for (const service of [...result.services, ...result.incomes]) {
    if (!service.propertyId) continue;
    const row = ensure(service.propertyId, service.propertyName);
    row.revenue += service.revenue || 0;
    for (const category of categories) row.costs[category] += service.costs[category];
    if (service.clientId && !row.clientIds.includes(service.clientId)) row.clientIds.push(service.clientId);
    if (serviceIds.has(service.id)) { row.services++; if (cleaningService(service.type)) row.cleanings++; }
    row.pending += Number(service.pending.length > 0); row.estimated += Number(service.estimated);
  }
  for (const expense of result.expenses) if (expense.propertyId) {
    const row = ensure(expense.propertyId); row.costs[expense.category] += expense.cents;
    if (expense.id.startsWith('allocation:')) row.allocated += expense.cents;
    if (expense.clientId && !row.clientIds.includes(expense.clientId)) row.clientIds.push(expense.clientId);
  }
  return [...rows.values()].map(row => { const expense = categories.reduce((sum, category) => sum + row.costs[category], 0), balance = row.revenue - expense; return { ...row, expense, result: balance, margin: row.revenue ? balance / row.revenue * 100 : null }; });
}
export function operationalKpis(result: FinancialAnalysis, properties: PropertyResult[]) {
  const cleanings = result.services.filter(row => cleaningService(row.type));
  const serviceCount = result.services.length;
  return { revenuePerProperty: properties.length ? properties.reduce((sum, row) => sum + row.revenue, 0) / properties.length : null,
    cleaningCost: cleanings.length ? cleanings.reduce((sum, row) => sum + row.expense, 0) / cleanings.length : null,
    personnelShare: result.total.revenue ? (result.total.costs.personal + result.total.costs.salary) / result.total.revenue * 100 : null,
    laundryPerService: serviceCount ? result.services.reduce((sum, row) => sum + row.costs.laundry, 0) / serviceCount : null,
    propertyMargin: properties.reduce((sum, row) => sum + row.revenue, 0) ? properties.reduce((sum, row) => sum + row.result, 0) / properties.reduce((sum, row) => sum + row.revenue, 0) * 100 : null };
}
export interface AlertRules { margin: number; days: number; zero: boolean }
export function financialAlerts(result: FinancialAnalysis, rules: AlertRules, today: string) {
  const age = (date: string) => validDate(today) ? Math.max(0, Math.floor((Date.parse(today) - Date.parse(date)) / 86400000)) : 0;
  return { clients: result.clients.filter(row => row.margin !== null && row.margin < rules.margin),
    pending: [...result.services, ...result.incomes].filter(row => row.pending.length && row.date < today && age(row.date) > rules.days).map(row => ({ ...row, age: age(row.date) })),
    zero: rules.zero ? result.excludedIncomeServices.filter(row => row.revenue === 0) : [] };
}
