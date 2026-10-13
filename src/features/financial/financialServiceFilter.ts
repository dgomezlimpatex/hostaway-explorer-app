import type { CalculatedService } from './financialModel';

export type ProfitFilter = 'all' | 'negative' | 'low';
// Negative result, or margin below 10 % of a positive billing.
export const matchesProfit = (service: CalculatedService, filter: ProfitFilter) => filter === 'all' || filter === 'negative' && (service.result ?? 0) < 0 || filter === 'low' && service.revenue! > 0 && (service.result ?? 0) / service.revenue! < .1;
