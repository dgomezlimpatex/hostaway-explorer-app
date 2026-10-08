import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { balanceColumns, type monthlyTrend } from './financialCharts';
import { FinancialTooltip } from './FinancialTooltip';
import { FinancialMoneyTick } from './FinancialMoneyTick';

export function FinancialLines({ rows }: { rows: ReturnType<typeof monthlyTrend> }) {
  const [hidden, setHidden] = useState<string[]>([]);
  return <div className="space-y-3">
    <div className="overflow-x-auto rounded-xl bg-slate-50/50" tabIndex={0} aria-label="Líneas de ingresos, gastos y resultado de doce meses"><div className="h-80 min-w-[620px]"><ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 15, right: 20, bottom: 5, left: 0 }}><CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#e2e8f0" /><XAxis dataKey="name" interval={0} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} /><YAxis width={80} tick={<FinancialMoneyTick />} axisLine={false} tickLine={false} /><ReferenceLine y={0} stroke="#cbd5e1" /><Tooltip content={<FinancialTooltip />} />
        {balanceColumns.map((column, index) => <Line key={column.id} hide={hidden.includes(column.id)} name={column.name} dataKey={column.id} type="linear" stroke={column.color} strokeDasharray={index === 1 ? '6 4' : undefined} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer></div></div>
    <ul aria-label="Series de la evolución" className="flex flex-wrap justify-center gap-4 text-xs text-slate-600">{balanceColumns.map(column => <li key={column.id}><button aria-pressed={!hidden.includes(column.id)} className={`inline-flex items-center gap-2 rounded-md px-2 py-1 hover:bg-violet-50 focus-visible:outline-violet-600 ${hidden.includes(column.id) ? 'opacity-50' : ''}`} onClick={() => setHidden(current => current.includes(column.id) ? current.filter(id => id !== column.id) : [...current, column.id])}><span className="h-0.5 w-4" style={{ background: column.color }} />{column.name}</button></li>)}</ul>
  </div>;
}
