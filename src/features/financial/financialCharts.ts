import { analyze, validDate, type Category, type Filters, type FinancialService, type FinanceSettings } from './financialModel';
import { financialMonthRange, financialYearRange } from './financialView';
import { financialName } from './financialFormat';
import { analyzeWithAllocation, type Allocation } from './financialAnalytics';
export { money } from './financialFormat';

export type FinancialAnalysis = ReturnType<typeof analyze>;
export const categoryNames: Record<Category, string> = { personal: 'Personal', laundry: 'Lavandería', supplies: 'Amenities y consumibles', products: 'Productos de limpieza', salary: 'Salario dirección turismo', other: 'Otros gastos' };
export const shortMoney = (cents: number) => new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(cents / 100) + ' €';
export const chartColors = ['#6d28d9', '#2563eb', '#db2777', '#d97706', '#0f766e', '#64748b'];
export type ComparisonView = 'balance' | 'costs' | 'incomes';
export interface ColumnSeries { id: string; name: string; color: string }
export interface ColumnGroup { name: string; start?: string; values: Record<string, number> }
export const balanceColumns: ColumnSeries[] = [
  { id: 'revenue', name: 'Ingresos', color: '#6d28d9' },
  { id: 'expense', name: 'Gastos', color: '#d97706' },
  { id: 'result', name: 'Resultado', color: '#059669' },
];
const revenueColumn = balanceColumns[0];
const expenseColumns: ColumnSeries[] = [
  { id: 'personal', name: 'Personal', color: chartColors[1] },
  { id: 'laundry', name: 'Lavandería', color: chartColors[2] },
  { id: 'supplies', name: 'Amenities y consumibles', color: chartColors[3] },
  { id: 'products', name: 'Productos', color: chartColors[4] },
  { id: 'other', name: 'Otros gastos', color: chartColors[5] },
];
// Direction/structure remains a separate accounting category. Combine it with
// personnel only for display, after the engine has applied the chosen filters.
export function groupedCosts(costs: FinancialAnalysis['total']['costs']) {
  return { personal: costs.personal + costs.salary, laundry: costs.laundry, supplies: costs.supplies, products: costs.products, other: costs.other };
}
function visibleExpenseColumns(costs: FinancialAnalysis['total']['costs'][]) {
  return expenseColumns.filter(column => column.id !== 'other' || costs.some(cost => cost.other !== 0));
}
export function periodColumns(total: FinancialAnalysis['total']) {
  return { series: [revenueColumn, ...visibleExpenseColumns([total.costs])], values: { revenue: total.revenue, ...groupedCosts(total.costs) } };
}
export function incomeColor(id: string) {
  const fixed = { cleaning: '#6d28d9', services: '#4f46e5', supplements: '#0284c7', cloth: '#0f766e' };
  if (id in fixed) return fixed[id as keyof typeof fixed];
  const hash = [...id].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
  return `hsl(${hash % 360}, 65%, 40%)`;
}

// Presentation only: every amount comes from the same analysis as the tables.
export function dashboardSeries(analysis: FinancialAnalysis) {
  const values = groupedCosts(analysis.total.costs);
  const costs = visibleExpenseColumns([analysis.total.costs]).map(column => ({ ...column, value: values[column.id as keyof typeof values] }));
  const incomes = new Map<string, { id: string; name: string; value: number; source: 'services' | 'incomes' }>();
  const add = (id: string, name: string, value: number, source: 'services' | 'incomes') => {
    const row = incomes.get(id) || { id, name, value: 0, source };
    row.value += value; incomes.set(id, row);
  };
  for (const service of analysis.services) {
    const cleaning = /^(limpieza|cleaning)/i.test(service.type.trim());
    add(cleaning ? 'cleaning' : 'services', cleaning ? 'Limpiezas · tarifa base' : 'Otros servicios · tarifa base', (service.revenue ?? 0) - (service.additionalRevenue || 0), 'services');
    add('supplements', 'Suplementos por limpieza', (service.additionalRevenue || 0) - (service.kitchenClothRevenue || 0), 'services');
    add('cloth', 'Cobro de paños de cocina', service.kitchenClothRevenue || 0, 'services');
  }
  for (const income of analysis.incomes) add(`external:${income.propertyName}`, income.propertyName, income.revenue ?? 0, 'incomes');
  return { costs, incomes: [...incomes.values()].filter(row => row.value !== 0).map(row => ({ ...row, name: financialName(row.name), color: incomeColor(row.id) })) };
}

export function adjacentMonth(start: string, offset: number) {
  if (!validDate(start)) return null;
  const date = new Date(start.slice(0, 7) + '-01T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + offset);
  return financialMonthRange(date.toISOString().slice(0, 7));
}

// Monthly totals are recalculated by the engine, never bucketed by the final
// date of a recurring income (which would create artificial month-end spikes).
export function trendPeriods(end: string, matchingDays: boolean, count = 6) {
  if (!validDate(end)) return [];
  return Array.from({ length: count }, (_, index) => {
    const full = adjacentMonth(end, index - count + 1)!;
    const day = matchingDays ? Math.min(Number(end.slice(8)), Number(full.end.slice(8))) : Number(full.end.slice(8));
    return { start: full.start, end: full.start.slice(0, 8) + String(day).padStart(2, '0') };
  });
}

export function annualPeriods(year: string) {
  const range = financialYearRange(year);
  if (!range) return [];
  return Array.from({ length: 12 }, (_, index) => index === 11 ? { start: `${year}-12-01`, end: range.end } : financialMonthRange(`${year}-${String(index + 1).padStart(2, '0')}`)!);
}
function periodTrend(services: FinancialService[], settings: FinanceSettings, filters: Filters, periods: Pick<Filters, 'start' | 'end'>[], allocation: Allocation) {
  return periods.map(period => {
    const result = analyzeWithAllocation(services, settings, { ...filters, ...period }, allocation);
    const manualCount = (settings.incomes || []).filter(income => income.mode === 'manual' && income.start >= period.start && income.start <= period.end &&
      result.incomes.some(row => row.id === `income:${income.id}:${income.start.slice(0, 7)}`)).length;
    return { ...period, ...result.total, incomeSources: dashboardSeries(result).incomes, manualCount, excludedPrices: result.excludedIncomeServices.filter(service => service.revenue === null).length,
      name: new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(period.start + 'T12:00:00Z')) };
  });
}
export function monthlyTrend(services: FinancialService[], settings: FinanceSettings, filters: Filters, matchingDays: boolean, count = 6, allocation: Allocation = 'none') {
  return periodTrend(services, settings, filters, trendPeriods(filters.end, matchingDays, count), allocation);
}
export function annualTrend(services: FinancialService[], settings: FinanceSettings, filters: Filters, allocation: Allocation = 'none') {
  return periodTrend(services, settings, filters, annualPeriods(filters.start.slice(0, 4)), allocation);
}

export function monthlyColumns(rows: ReturnType<typeof monthlyTrend>, view: ComparisonView): { series: ColumnSeries[]; groups: ColumnGroup[] } {
  if (view === 'balance' || view === 'costs') return {
    series: [...(view === 'balance' ? [revenueColumn] : []), ...visibleExpenseColumns(rows.map(row => row.costs))],
    groups: rows.map(row => ({ name: row.name, start: row.start, values: view === 'balance' ? { revenue: row.revenue, ...groupedCosts(row.costs) } : groupedCosts(row.costs) })),
  };
  const sources = new Map<string, ColumnSeries>();
  for (const row of rows) for (const source of row.incomeSources) sources.set(source.id, { id: source.id, name: source.name, color: source.color });
  return { series: [...sources.values()], groups: rows.map(row => ({ name: row.name, start: row.start, values: Object.fromEntries(row.incomeSources.map(source => [source.id, source.value])) })) };
}
