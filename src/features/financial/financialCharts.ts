import { analyze, validDate, type Category, type Filters, type FinancialService, type FinanceSettings } from './financialModel';
import { financialMonthRange } from './financialView';

export type FinancialAnalysis = ReturnType<typeof analyze>;
export const categoryNames: Record<Category, string> = { personal: 'Personal', laundry: 'Lavandería', supplies: 'Amenities y consumibles', products: 'Productos de limpieza', salary: 'Salario dirección turismo', other: 'Otros gastos' };
export const money = (cents: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const shortMoney = (cents: number) => new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(cents / 100) + ' €';
export const chartColors = ['#310984', '#7c3aed', '#a78bfa', '#c084fc', '#6366f1', '#64748b'];

// Presentation only: every amount comes from the same analysis as the tables.
export function dashboardSeries(analysis: FinancialAnalysis) {
  const costs = (Object.keys(categoryNames) as Category[]).map((id, index) => ({ id, name: categoryNames[id], value: analysis.total.costs[id], color: chartColors[index] }));
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
  let balance = analysis.total.revenue;
  const waterfall = [{ name: 'Ingresos', value: balance, range: [0, balance], color: '#310984' }];
  for (const cost of costs.filter(row => row.value > 0)) {
    const next = balance - cost.value;
    waterfall.push({ name: cost.name, value: -cost.value, range: [next, balance], color: cost.color });
    balance = next;
  }
  waterfall.push({ name: 'Resultado', value: balance, range: [Math.min(0, balance), Math.max(0, balance)], color: balance < 0 ? '#be123c' : '#047857' });
  return { costs, incomes: [...incomes.values()].filter(row => row.value !== 0), waterfall };
}

export function adjacentMonth(start: string, offset: number) {
  if (!validDate(start)) return null;
  const date = new Date(start.slice(0, 7) + '-01T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + offset);
  return financialMonthRange(date.toISOString().slice(0, 7));
}

// Monthly totals are recalculated by the engine, never bucketed by the final
// date of a recurring income (which would create artificial month-end spikes).
export function trendPeriods(end: string, matchingDays: boolean) {
  if (!validDate(end)) return [];
  return Array.from({ length: 6 }, (_, index) => {
    const full = adjacentMonth(end, index - 5)!;
    const day = matchingDays ? Math.min(Number(end.slice(8)), Number(full.end.slice(8))) : Number(full.end.slice(8));
    return { start: full.start, end: full.start.slice(0, 8) + String(day).padStart(2, '0') };
  });
}

export function monthlyTrend(services: FinancialService[], settings: FinanceSettings, filters: Filters, matchingDays: boolean) {
  return trendPeriods(filters.end, matchingDays).map(period => {
    const result = analyze(services, settings, { ...filters, ...period });
    const manualCount = (settings.incomes || []).filter(income => income.mode === 'manual' && income.start >= period.start && income.start <= period.end &&
      (!filters.clients.length || filters.clients.includes(income.clientId)) && (!filters.properties.length || filters.properties.includes(income.propertyId)) && (!filters.workers.length || filters.workers.includes(income.workerId))).length;
    return { ...period, ...result.total, manualCount, excludedPrices: result.excludedIncomeServices.filter(service => service.revenue === null).length,
      name: new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(period.start + 'T12:00:00Z')) };
  });
}
