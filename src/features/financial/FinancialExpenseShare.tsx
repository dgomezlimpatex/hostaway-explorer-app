import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { money, percent } from './financialFormat';
import { FinancialTooltip } from './FinancialTooltip';
import type { ColumnSeries } from './financialCharts';

export function FinancialExpenseShare({ rows, total, onDetails }: { rows: (ColumnSeries & { value: number })[]; total: number; onDetails: (id: string) => void }) {
  return <>
    {total > 0 ? <div className="mt-4 h-64" aria-hidden="true"><ResponsiveContainer width="100%" height="100%">
      <PieChart><Tooltip content={<FinancialTooltip />} /><Pie data={rows} dataKey="value" nameKey="name" innerRadius={64} outerRadius={100} paddingAngle={2} isAnimationActive={false} onClick={(_row, index) => onDetails(rows[index].id)}>
        {rows.map(row => <Cell key={row.id} fill={row.color} cursor="pointer" />)}
      </Pie></PieChart>
    </ResponsiveContainer></div> : <p className="py-8 text-center text-sm text-slate-500">Sin gastos incluidos en este periodo.</p>}
    <ul className="mt-4 space-y-1">{rows.map(row => <li key={row.id}><button data-financial-concept={row.id} onClick={() => onDetails(row.id)} aria-label={`Ver gasto: ${row.name}`} className="flex w-full items-center justify-between gap-3 rounded-lg p-2 text-left text-sm hover:bg-violet-50 focus-visible:outline-violet-600">
      <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} />{row.name}</span>
      <span className="shrink-0 tabular-nums"><strong>{money(row.value)}</strong><span className="ml-3 text-xs text-slate-500">{percent(total ? row.value / total * 100 : 0)}</span></span>
    </button></li>)}</ul>
  </>;
}
