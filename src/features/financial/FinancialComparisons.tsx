import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FinancialColumns } from './FinancialColumns';
import { FinancialHelp } from './FinancialHelp';
import { balanceColumns } from './financialCharts';
import { compareBudget } from './financialBudget';
import { useFinancialBudgets } from './useFinancialBudgets';
import { kpiChange, type financialInsights } from './financialInsights';
import { money, percent, decimal } from './financialFormat';
import type { Allocation } from './financialAnalytics';
import type { Filters, Summary, FinancialService, FinanceSettings } from './financialModel';

type Comparison = 'previous' | 'year' | 'budget';
export function FinancialComparisons({ sedeId, services, settings, filters, allocation, summary, insights, comparison, budgetId, onComparison, onBudget, onDetails }: {
  sedeId: string; services: FinancialService[]; settings: FinanceSettings; filters: Filters; allocation: Allocation; summary: Summary; insights: ReturnType<typeof financialInsights>; comparison: Comparison; budgetId: string;
  onComparison: (mode: Comparison) => void; onBudget: (id: string) => void; onDetails: (id: string, period?: Pick<Filters, 'start' | 'end'>) => void;
}) {
  const budgets = useFinancialBudgets(sedeId, comparison === 'budget', budgetId);
  let actual: Pick<Summary, 'revenue' | 'expense' | 'result' | 'margin'> = summary, base = insights.previous as typeof actual | null, problem = '';
  if (comparison === 'budget') {
    base = null;
    if (budgets.budget && budgets.detail.data) try { const comparison = compareBudget(budgets.budget, budgets.detail.data, services, settings, filters, allocation); actual = comparison.actual.total; base = comparison.projection; } catch (error) { problem = error instanceof Error ? error.message : 'Presupuesto no comparable'; }
  }
  const keys = ['revenue', 'expense', 'result', 'margin'] as const;
  const labels = ['Ingresos', 'Gastos', 'Resultado', 'Margen'];
  const title = comparison === 'budget' ? 'Real incluido vs presupuesto' : 'Periodo seleccionado vs periodo anterior';
  return <section className="min-w-0 space-y-4 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm" aria-label="Comparativas financieras">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-[#310984]">Comparativas</h2><FinancialHelp section="Comparativas"><p>Las comparaciones temporales conservan todos los filtros y la clave de reparto. El mismo periodo del año anterior ajusta el 29 de febrero al último día válido.</p><p>Un presupuesto se selecciona del Presupuestador por su versión vigente y propiedades vinculadas. Se compara solo la actividad de limpieza de esas propiedades y cliente, nunca contra toda la empresa. Sus importes mensuales se proyectan por los días seleccionados, sin asumir estacionalidad ni fecha de vigencia.</p><p>Los suplementos y consumos reales pueden diferir del alcance comercial presupuestado. Costes reales pendientes hacen provisional la desviación. Subir gastos es desfavorable; el margen se compara en puntos porcentuales.</p></FinancialHelp></div>
    <div className="flex flex-wrap gap-2">{([['previous', 'Periodo anterior'], ['year', 'Mismo periodo año anterior'], ['budget', 'Presupuesto']] as const).map(([id, label]) => <Button key={id} size="sm" variant={comparison === id ? 'default' : 'outline'} aria-pressed={comparison === id} onClick={() => onComparison(id)}>{label}</Button>)}</div>
    {comparison === 'budget' ? <div className="space-y-3"><div className="flex flex-wrap items-center gap-3"><label className="min-w-0 flex-1 text-sm">Presupuesto del Presupuestador<select aria-label="Presupuesto para comparar" value={budgetId} onChange={event => onBudget(event.target.value)} className="mt-1 h-10 w-full rounded-md border bg-white px-3"><option value="">Seleccionar presupuesto</option>{budgets.list.data?.map(row => <option key={row.id} value={row.id}>{row.quote_number} · {row.title} · {row.status}</option>)}</select></label><Button variant="outline" asChild><Link to="/budget-estimator">Abrir Presupuestador</Link></Button></div>
      {(budgets.list.error || budgets.detail.error) && <div role="alert" className="text-sm text-amber-800">No se pudo cargar el presupuesto. <button className="underline" onClick={() => { budgets.list.refetch(); if (budgets.budget) budgets.detail.refetch(); }}>Reintentar lectura</button></div>}
      {(budgets.list.isFetching || budgets.detail.isFetching) && <p role="status" className="text-sm text-slate-500">Cargando presupuesto…</p>}
      {budgets.list.data?.length === 0 && <p className="text-sm text-slate-500">No hay presupuestos accesibles en esta sede.</p>}
      {budgets.budget && <p className="text-xs text-slate-500">Versión {budgets.budget.current_version_number} · Comparación de su cliente y propiedades · Proyección mensual sin IVA. Las tarjetas superiores conservan el balance completo de tus filtros y su comparación temporal.</p>}
      {problem && <p role="status" className="text-sm text-amber-800">{problem}</p>}</div> : insights.period && <p className="text-xs text-slate-500">Base: {insights.period.start} – {insights.period.end} · Mismos filtros</p>}
    {base && !(comparison === 'budget' && (budgets.list.error || budgets.detail.error || budgets.list.isFetching || budgets.detail.isFetching)) ? <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{keys.map((key, index) => { const change = kpiChange(actual, base, key); return <article key={key} className="rounded-xl bg-slate-50 p-3"><h3 className="text-xs text-slate-600">{labels[index]}</h3><p className="mt-2 text-lg font-semibold tabular-nums">{key === 'margin' ? percent(actual[key]) : money(actual[key])}</p><p className="mt-1 text-xs text-slate-500">Base: {key === 'margin' ? percent(base[key]) : money(base[key])}</p><p className={`mt-2 text-xs font-medium tabular-nums ${change?.direction === 'worse' ? 'text-rose-700' : change?.direction === 'better' ? 'text-emerald-700' : 'text-slate-600'}`}>{change ? `${change.delta > 0 ? '+' : ''}${key === 'margin' ? decimal(change.delta) + ' pp' : money(change.delta)}${key === 'margin' ? '' : ' · ' + (change.relative === null ? 'Sin base %' : percent(change.relative))}` : 'Sin base comparativa'}</p></article>; })}</div>
      <FinancialColumns label={title} series={balanceColumns} groups={[{ name: comparison === 'budget' ? 'Real · alcance del presupuesto' : 'Seleccionado', start: filters.start, values: { revenue: actual.revenue, expense: actual.expense, result: actual.result } }, { name: comparison === 'budget' ? 'Presupuesto proyectado' : 'Anterior', start: insights.period?.start, values: { revenue: base.revenue, expense: base.expense, result: base.result } }]} {...(comparison === 'budget' ? {} : { onSelect: (id: string, index?: number) => onDetails(id, index === 1 && insights.period ? insights.period : undefined) })} /></> : comparison !== 'budget' && <p className="text-sm text-slate-500">Sin base comparativa válida.</p>}
  </section>;
}
