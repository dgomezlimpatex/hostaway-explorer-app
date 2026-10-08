import { analyzeWithAllocation, cleaningService, type Allocation } from './financialAnalytics';
import { validDate, type Filters, type FinancialService, type FinanceSettings } from './financialModel';

export interface FinancialBudget { id: string; title: string; quote_number: string; client_id: string | null; status: string; current_version_number: number }
export interface BudgetPropertyProjection { propertyId: string; revenue: number; expense: number }
export function readBudgetProjection(items: { property_id: string | null; result_snapshot: unknown }[]): BudgetPropertyProjection[] {
  if (!items.length || items.some(item => !item.property_id)) throw new Error('El presupuesto debe tener todas sus propiedades vinculadas para comparar su alcance.');
  return items.map(item => {
    const snapshot = item.result_snapshot as { monthly?: { totalRevenue?: number; totalCost?: number } };
    const revenue = snapshot?.monthly?.totalRevenue, expense = snapshot?.monthly?.totalCost;
    if (typeof revenue !== 'number' || typeof expense !== 'number' || !Number.isFinite(revenue) || !Number.isFinite(expense) || revenue < 0 || expense < 0 || revenue > 100000000 || expense > 100000000) throw new Error('Faltan importes mensuales válidos en una propiedad del presupuesto.');
    return { propertyId: item.property_id!, revenue: Math.round(revenue * 100), expense: Math.round(expense * 100) };
  });
}
export function budgetPeriodFactor(filters: Pick<Filters, 'start' | 'end'>) {
  if (!validDate(filters.start) || !validDate(filters.end) || filters.start > filters.end) return 0;
  let factor = 0;
  const cursor = new Date(filters.start + 'T00:00:00Z');
  while (cursor.toISOString().slice(0, 10) <= filters.end) {
    factor += 1 / new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return factor;
}
export function compareBudget(budget: FinancialBudget, items: BudgetPropertyProjection[], services: FinancialService[], settings: FinanceSettings, filters: Filters, allocation: Allocation) {
  if (filters.workers.length || filters.categories?.length) throw new Error('El presupuesto no desglosa trabajadores ni categorías de gasto. Quita esos filtros para una comparación equivalente.');
  if (filters.types?.some(type => !cleaningService(type))) throw new Error('Este presupuesto cubre limpiezas. Quita los tipos de servicio distintos de limpieza para compararlo.');
  if (!budget.client_id) throw new Error('El presupuesto necesita un cliente vinculado para compararlo.');
  if (filters.clients.length && !filters.clients.includes(budget.client_id)) throw new Error('El cliente del presupuesto queda fuera de los filtros actuales.');
  const selected = items.filter(item => (!filters.properties.length || filters.properties.includes(item.propertyId)) && (filters.propertyScope === undefined || filters.propertyScope.includes(item.propertyId)));
  if (!selected.length) throw new Error('Ninguna propiedad del presupuesto coincide con los filtros actuales.');
  const factor = budgetPeriodFactor(filters), revenue = Math.round(selected.reduce((sum, item) => sum + item.revenue, 0) * factor), expense = Math.round(selected.reduce((sum, item) => sum + item.expense, 0) * factor);
  const types = filters.types?.length ? filters.types : [...new Set(services.filter(service => cleaningService(service.type)).map(service => service.type))];
  const actual = analyzeWithAllocation(services, settings, { ...filters, clients: [budget.client_id], properties: [...new Set(selected.map(item => item.propertyId))], types: types.length ? types : ['__no_cleaning_services__'] }, allocation);
  return { actual, projection: { revenue, expense, result: revenue - expense, margin: revenue ? (revenue - expense) / revenue * 100 : null }, propertyIds: selected.map(item => item.propertyId), factor };
}
