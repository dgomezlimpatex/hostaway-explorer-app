import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money, shortMoney, type ColumnGroup, type ColumnSeries } from './financialCharts';

interface Props {
  groups: ColumnGroup[];
  series: ColumnSeries[];
  label: string;
  onSelect?: (id: string) => void;
}

export function FinancialColumns({ groups, series, label, onSelect }: Props) {
  const hasValues = groups.some(group => series.some(column => (group.values[column.id] ?? 0) !== 0));
  if (!hasValues) return <p className="py-10 text-center text-sm text-slate-500">Sin importes registrados para esta comparación.</p>;
  return <div className="mt-5">
    <div className="overflow-x-auto rounded-xl bg-slate-50/50" tabIndex={0} aria-label={label}>
      <div className="h-72" style={{ minWidth: Math.max(320, groups.length * series.length * 24 + 80) }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={groups} barGap={5} barCategoryGap="18%" margin={{ left: 0, right: 20, top: 20, bottom: 8 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={shortMoney} width={65} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={value => money(Number(value))} cursor={{ fill: '#ede9fe', fillOpacity: .5 }}
              contentStyle={{ borderRadius: 16, border: '1px solid #ede9fe', boxShadow: '0 8px 24px #31098414', fontSize: 13 }}
              labelStyle={{ color: '#334155', fontWeight: 600, marginBottom: 8 }} />
            <ReferenceLine y={0} stroke="#cbd5e1" />
            {series.map(column => <Bar key={column.id} name={column.name} dataKey={group => group.values[column.id] ?? 0}
              fill={column.color} radius={[5, 5, 0, 0]} barSize={groups.length === 1 ? 48 : undefined} maxBarSize={60} isAnimationActive={false}
              onClick={onSelect ? () => onSelect(column.id) : undefined} cursor={onSelect ? 'pointer' : undefined} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
    <ul aria-label={`Leyenda · ${label}`} className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600">
      {series.map(column => <li key={column.id} className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: column.color }} />
        {onSelect ? <button className="text-left hover:underline focus-visible:outline-violet-600" onClick={() => onSelect(column.id)} aria-label={`Ver concepto: ${column.name}`}>{column.name}</button> : column.name}
      </li>)}
    </ul>
    <p className="mt-3 text-center text-xs text-slate-500">Una columna por concepto · misma escala · sin IVA<span className="block sm:hidden">Desliza el gráfico para ver todas las columnas.</span></p>
  </div>;
}
