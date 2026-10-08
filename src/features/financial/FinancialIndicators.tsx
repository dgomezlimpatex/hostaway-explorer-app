import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import { money, percent, decimal } from './financialFormat';
import { FinancialTooltip } from './FinancialTooltip';
import { FinancialHelp } from './FinancialHelp';
import { kpiChange, type Kpi, type financialInsights } from './financialInsights';
import type { Summary } from './financialModel';

const labels: Record<Kpi, string> = { revenue: 'Ingresos totales', expense: 'Gastos incluidos', result: 'Resultado', margin: 'Margen' };
export function FinancialIndicators({ summary, insights }: { summary: Summary; insights: ReturnType<typeof financialInsights> }) {
  return <section aria-label="Indicadores financieros" className="space-y-2">
    <div className="flex justify-end"><FinancialHelp section="Indicadores"><p>Importes sin IVA y provisionales: se usan las tarifas actuales y los costes incluidos. No existe un cierre contable registrado.</p><p>La comparación conserva los filtros y el intervalo de días. Un mes completo se compara con el anterior completo; un año, con el año anterior. Los intervalos entre meses se comparan con un periodo anterior de igual duración.</p><p>El margen cambia en puntos porcentuales. Sin una base anterior distinta de cero no se calcula una variación porcentual.</p><p>Las líneas muestran los últimos seis meses de la evolución. En periodos parciales terminan en el mismo día de cada mes. Los ingresos puntuales ausentes no confirman ingreso real cero.</p>{insights.period && <p>Periodo anterior: {insights.period.start.split('-').reverse().join('/')} – {insights.period.end.split('-').reverse().join('/')}</p>}</FinancialHelp></div>
    <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 xl:grid-cols-4">{(['revenue', 'expense', 'result', 'margin'] as const).map(key => {
      const change = kpiChange(summary, insights.previous, key), value = summary[key];
      const color = change?.direction === 'better' ? '#047857' : change?.direction === 'worse' ? '#be123c' : '#7c3aed';
      const signed = (text: string) => (change && change.delta > 0 ? '+' : '') + text;
      return <article key={key} aria-label={labels[key]} className="min-w-0 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-1.5"><h2 className="text-sm font-medium text-slate-600">{labels[key]}</h2><span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">Provisional</span></div>
        <p className={`mt-3 whitespace-nowrap text-xl font-semibold tracking-tight tabular-nums sm:text-2xl 2xl:text-3xl ${(key === 'result' || key === 'margin') && value !== null ? value < 0 ? 'text-rose-700' : 'text-emerald-700' : 'text-[#310984]'}`}>{key === 'margin' ? percent(value) : money(value || 0)}</p>
        <div className={`mt-3 flex min-h-6 items-start gap-1 text-xs font-medium tabular-nums ${change?.direction === 'better' ? 'text-emerald-700' : change?.direction === 'worse' ? 'text-rose-700' : 'text-slate-600'}`}>
          {change ? <>{change.delta === 0 ? <Minus aria-hidden className="h-4 w-4 shrink-0" /> : change.delta > 0 ? <ArrowUpRight aria-hidden className="h-4 w-4 shrink-0" /> : <ArrowDownRight aria-hidden className="h-4 w-4 shrink-0" />}<span>{key === 'margin' ? `${signed(decimal(change.delta))} pp` : `${signed(money(change.delta))} · ${change.relative === null ? 'Sin base %' : percent(change.relative)}`}</span></> : 'Sin base comparativa'}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">{insights.period?.label || 'Comparación no disponible'}</p>
        <div className="mt-3 h-12" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><LineChart data={insights.rows.slice(-6).map(row => ({ ...row, periodLabel: row.name }))} margin={{ top: 5, bottom: 5, right: 5, left: 5 }}><Tooltip content={<FinancialTooltip format={key === 'margin' ? percent : money} />} /><Line name={labels[key]} type="linear" dataKey={key} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} /></LineChart></ResponsiveContainer></div>
        <p className="text-[10px] text-slate-500">Últimos 6 meses · sin IVA</p>
      </article>;
    })}</div>
  </section>;
}
