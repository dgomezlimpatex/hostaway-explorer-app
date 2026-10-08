import { shortMoney } from './financialCharts';

export function FinancialMoneyTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: number } }) {
  return <text x={x - 5} y={y} textAnchor="end" dominantBaseline="central" fill="#64748b" fontSize={11}>{shortMoney(payload?.value || 0)}</text>;
}
