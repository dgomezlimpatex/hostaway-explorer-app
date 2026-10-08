import { COST_ITEMS, type CalculatedService, type FinanceSettings } from './financialModel';
import { categoryNames, dashboardSeries, groupedCosts, money, type FinancialAnalysis } from './financialCharts';
import type { FinancialDetailConcept } from './financialView';

const incomeLabels = { revenue: 'Ingresos', cleaning: 'Limpiezas · tarifa base', services: 'Otros servicios · tarifa base', supplements: 'Suplementos por limpieza', cloth: 'Cobro de paños de cocina' };
const hours = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
export function detailLabel(concept: FinancialDetailConcept) {
  if (concept.startsWith('external:')) return concept.slice(9);
  if (concept in incomeLabels) return incomeLabels[concept as keyof typeof incomeLabels];
  return concept === 'products' ? 'Productos' : categoryNames[concept as keyof typeof categoryNames];
}
export const isIncomeConcept = (concept: FinancialDetailConcept) => concept in incomeLabels || concept.startsWith('external:');
export interface FinancialDetailRow {
  id: string; date: string; label: string; clientId: string; source: 'services' | 'incomes' | 'expenses';
  amount: number; description: string; pending: string[]; direction: boolean;
}
function serviceAmount(service: CalculatedService, concept: FinancialDetailConcept) {
  if (concept === 'revenue') return service.revenue ?? 0;
  if (concept === 'cleaning' || concept === 'services') return /^(limpieza|cleaning)/i.test(service.type.trim()) === (concept === 'cleaning') ? (service.revenue ?? 0) - (service.additionalRevenue || 0) : 0;
  if (concept === 'supplements') return (service.additionalRevenue || 0) - (service.kitchenClothRevenue || 0);
  if (concept === 'cloth') return service.kitchenClothRevenue || 0;
  return concept.startsWith('external:') ? 0 : groupedCosts(service.costs)[concept as keyof ReturnType<typeof groupedCosts>];
}
function serviceDescription(service: CalculatedService, concept: FinancialDetailConcept, settings: FinanceSettings) {
  const adjustment = settings.adjustments[service.id];
  if (concept === 'revenue') return `Tarifa base: ${money((service.revenue ?? 0) - (service.additionalRevenue || 0))} · Suplementos: ${money((service.additionalRevenue || 0) - (service.kitchenClothRevenue || 0))} · Paño: ${money(service.kitchenClothRevenue || 0)}`;
  if (concept === 'personal') return service.workers.map(worker => { const minutes = adjustment?.minutes?.[worker.id] ?? worker.minutes; return `${worker.name}: ${minutes === null ? 'horas pendientes' : `${hours.format(minutes / 60)} h`}`; }).join(' · ');
  if (concept === 'laundry' || concept === 'supplies') {
    const quantities = { ...service.quantities, ...adjustment?.quantities };
    return COST_ITEMS.filter(item => item.category === concept && (quantities[item.id] || 0) > 0).map(item => `${item.label}: ${quantities[item.id]}`).join(' · ');
  }
  return concept === 'products' ? 'Calculado sobre la tarifa base de limpieza' : detailLabel(concept);
}
// Read-only detail of the already filtered analysis: no re-pricing or writes.
export function financialDetail(analysis: FinancialAnalysis, concept: FinancialDetailConcept, settings: FinanceSettings) {
  const rows: FinancialDetailRow[] = [];
  for (const service of analysis.services) {
    const amount = serviceAmount(service, concept);
    if (amount) rows.push({ id: `service:${service.id}`, date: service.date, label: service.propertyName, clientId: service.clientId, source: 'services', amount,
      description: serviceDescription(service, concept, settings), pending: service.pending, direction: false });
  }
  for (const income of analysis.incomes) {
    const amount = concept === 'revenue' || concept === `external:${income.propertyName}` ? income.revenue ?? 0 : isIncomeConcept(concept) ? 0 : groupedCosts(income.costs)[concept as keyof ReturnType<typeof groupedCosts>];
    if (amount) rows.push({ id: income.id, date: income.date, label: income.propertyName, clientId: income.clientId, source: 'incomes', amount,
      description: isIncomeConcept(concept) ? 'Ingreso externo incluido en el periodo' : 'Coste asociado a un ingreso externo', pending: income.pending, direction: false });
  }
  if (!isIncomeConcept(concept)) for (const expense of analysis.expenses) {
    if (expense.category !== concept && !(concept === 'personal' && expense.category === 'salary')) continue;
    if (expense.cents) rows.push({ id: `expense:${expense.id}`, date: expense.date, label: expense.label, clientId: expense.clientId, source: 'expenses', amount: expense.cents,
      description: expense.category === 'salary' ? 'Dirección y estructura' : categoryNames[expense.category], pending: [], direction: expense.category === 'salary' });
  }
  const total = concept === 'revenue' ? analysis.total.revenue : isIncomeConcept(concept) ? dashboardSeries(analysis).incomes.find(row => row.id === concept)?.value ?? 0 : groupedCosts(analysis.total.costs)[concept as keyof ReturnType<typeof groupedCosts>];
  return { label: detailLabel(concept), total, rows: rows.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label)),
    sources: (['services', 'incomes', 'expenses'] as const).map(id => ({ id, amount: rows.filter(row => row.source === id).reduce((sum, row) => sum + row.amount, 0) })) };
}
