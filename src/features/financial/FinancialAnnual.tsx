import { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FinancialColumns } from './FinancialColumns';
import { annualTrend, groupedCosts, money, monthlyColumns, type ComparisonView } from './financialCharts';
import type { Filters, FinanceSettings, FinancialService } from './financialModel';
import { percent } from './financialFormat';
import { FinancialHelp } from './FinancialHelp';
import { FinancialLines } from './FinancialLines';

export function FinancialAnnual({ services, settings, filters, comparison, onComparison, onDetails }: {
  services: FinancialService[]; settings: FinanceSettings; filters: Filters;
  comparison: ComparisonView; onComparison: (view: ComparisonView) => void;
  onDetails: (concept: string, period?: Pick<Filters, 'start' | 'end'>) => void;
}) {
  const rows = useMemo(() => annualTrend(services, settings, filters), [services, settings, filters]);
  const columns = useMemo(() => monthlyColumns(rows, comparison), [rows, comparison]);
  const hasOtherCosts = rows.some(row => row.costs.other !== 0);
  return <section tabIndex={-1} className="min-w-0 space-y-5 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm sm:p-6" aria-label="Resumen anual por meses">
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold text-[#310984]"><CalendarDays className="h-5 w-5" />Vista anual · {filters.start.slice(0, 4)}</h2>
      <FinancialHelp section="Vista anual"><p>Enero a diciembre, mismos filtros y sin IVA. Personal incluye dirección y estructura.</p><p>Pulsa una barra para ver el concepto de ese mes; la leyenda abre el total del año. En móvil puedes deslizar el gráfico.</p><p>Año completo con tarifas actuales, fijos configurados y tareas futuras asignadas. Los ingresos puntuales solo cuentan cuando están registrados; su ausencia no confirma ingreso real cero. Los resultados son provisionales.</p></FinancialHelp></div>
    <div className="flex flex-wrap gap-2" aria-label="Conceptos de la vista anual">{([['balance', 'Ingresos y gastos'], ['costs', 'Tipos de gasto'], ['incomes', 'Origen de ingresos']] as const).map(([id, label]) => <Button key={id} variant={comparison === id ? 'default' : 'outline'} aria-pressed={comparison === id} onClick={() => onComparison(id)}>{label}</Button>)}</div>
    <FinancialColumns compact label="Comparación de los doce meses" series={columns.series} groups={columns.groups} onSelect={(id, index) => {
      const month = index === undefined ? undefined : rows[index];
      onDetails(id, month && { start: month.start, end: month.end });
    }} />
    <div className="space-y-3 border-t border-violet-100 pt-5"><h3 className="text-sm font-semibold text-slate-700">Evolución de ingresos, gastos y resultado</h3><FinancialLines rows={rows} /></div>
    <details className="border-t border-violet-100 pt-4"><summary className="cursor-pointer font-medium text-[#310984]">Desglose de los doce meses</summary>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Ingresos y gastos desglosados por mes sin IVA</caption>
        <thead className="bg-violet-50 text-[#310984]"><tr>{['Mes', 'Ingresos', 'Personal', 'Lavandería', 'Amenities y consumibles', 'Productos', ...(hasOtherCosts ? ['Otros gastos'] : []), 'Total gastos', 'Resultado', 'Margen', 'Costes / precios pendientes', 'Ingresos puntuales'].map(label => <th scope="col" className="whitespace-nowrap p-3 text-left" key={label}>{label}</th>)}</tr></thead>
        <tbody>{rows.map(row => { const costs = groupedCosts(row.costs); return <tr key={row.start} className="border-b border-violet-50">
          <th scope="row" className="whitespace-nowrap p-3 text-left"><button className="text-[#310984] hover:underline focus-visible:outline-violet-600" aria-label={`Ver ingresos de ${row.name}`} onClick={() => onDetails('revenue', { start: row.start, end: row.end })}>{row.name}</button></th>
          {[row.revenue, costs.personal, costs.laundry, costs.supplies, costs.products, ...(hasOtherCosts ? [costs.other] : []), row.expense, row.result].map((value, index) => <td key={index} className="whitespace-nowrap p-3 tabular-nums">{money(value)}</td>)}
          <td className={`whitespace-nowrap p-3 tabular-nums ${row.margin === null ? "text-slate-500" : row.margin < 0 ? "text-rose-700" : "text-emerald-700"}`}>{percent(row.margin)}</td><td className="p-3">{row.pending} / {row.excludedPrices}</td><td className="whitespace-nowrap p-3">{row.manualCount || 'Ninguno registrado'}</td>
        </tr>; })}</tbody>
      </table></div>
    </details>
  </section>;
}
