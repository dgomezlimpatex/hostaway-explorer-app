import { Bar, BarChart, CartesianGrid, Cell, Rectangle, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './financialColumns.css';
import { money, shortMoney, type ColumnGroup, type ColumnSeries } from './financialCharts';
import { FinancialTooltip } from './FinancialTooltip';

interface Props {
  groups: ColumnGroup[];
  series: ColumnSeries[];
  label: string;
  onSelect?: (id: string, groupIndex?: number) => void;
  compact?: boolean;
}

function ColumnShape({ x, y, width, height, index = 0, column, groups, onSelect }: {
  x?: number; y?: number; width?: number; height?: number; index?: number;
  column: ColumnSeries; groups: ColumnGroup[]; onSelect?: Props['onSelect'];
}) {
  const group = groups[index];
  if (!group || !width || !height) return null;
  return <g data-financial-concept={column.id} data-period-start={group?.start}><Rectangle x={x} y={y} width={width} height={height} fill={column.color} radius={[5, 5, 0, 0]}
    className="financial-column" tabIndex={onSelect ? 0 : undefined} role={onSelect ? 'button' : undefined}
    aria-label={onSelect && group ? `${column.name} · ${group.name} · ${money(group.values[column.id] ?? 0)} · Ver desglose` : undefined}
    onClick={onSelect ? () => onSelect(column.id, index) : undefined}
    onKeyDown={onSelect ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onSelect(column.id, index); } } : undefined} /></g>;
}

function ConceptTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const words = String(payload?.value || '').split(' '), lines: string[] = [];
  for (const word of words) {
    if (!lines.length || (lines.at(-1)!.length + word.length + 1 > 16)) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  }
  return <text x={x} y={y + 12} textAnchor="middle" fill="#64748b" fontSize={11}>{lines.slice(0, 3).map((line, index) => <tspan key={index} x={x} dy={index ? 14 : 0}>{index === 2 && lines.length > 3 ? `${line}…` : line}</tspan>)}</text>;
}

export function FinancialColumns({ groups, series, label, onSelect, compact = false }: Props) {
  const hasValues = groups.some(group => series.some(column => (group.values[column.id] ?? 0) !== 0));
  if (!hasValues) return <p data-financial-empty className="py-10 text-center text-sm text-slate-500">Sin importes registrados para esta comparación.</p>;
  const single = groups.length === 1;
  const points = single ? series.map(column => ({ name: column.name, conceptName: column.name, periodLabel: groups[0].name, value: groups[0].values[column.id] || 0, fill: column.color })) : groups;
  return <div className="mt-5">
    <div className="overflow-x-auto rounded-xl bg-slate-50/50" tabIndex={0} aria-label={label}>
      <div className="h-80" style={{ minWidth: single ? Math.max(320, series.length * 110 + 85) : Math.max(320, groups.length * series.length * (compact ? 18 : 24) + 80) }} aria-hidden={onSelect ? undefined : true}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart accessibilityLayer={false} data={points} barGap={compact ? 3 : 5} barCategoryGap={single ? '24%' : compact ? '15%' : '18%'} margin={{ left: 0, right: 20, top: 20, bottom: 8 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" height={single ? 62 : 30} interval={single ? 0 : undefined} tick={single ? <ConceptTick /> : { fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={shortMoney} width={65} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip shared={false} content={<FinancialTooltip />} cursor={{ fill: '#ede9fe', fillOpacity: .5 }} />
            <ReferenceLine y={0} stroke="#cbd5e1" />
            {single ? <Bar dataKey="value" maxBarSize={52} isAnimationActive={false} shape={(props: { x?: number; y?: number; width?: number; height?: number; index?: number }) => <ColumnShape {...props} column={series[props.index || 0]} index={0} groups={groups} onSelect={onSelect} />}>
              {series.map(column => <Cell key={column.id} fill={column.color} />)}
            </Bar> : series.map(column => <Bar key={column.id} name={column.name} dataKey={group => group.values[column.id] ?? 0}
              fill={column.color} radius={[5, 5, 0, 0]} maxBarSize={60} isAnimationActive={false}
              shape={<ColumnShape column={column} groups={groups} onSelect={onSelect} />} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
    <ul aria-label={`Leyenda · ${label}`} className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600">
      {series.map(column => <li key={column.id} className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: column.color }} />
        {onSelect ? <button data-financial-concept={column.id} className="text-left hover:underline focus-visible:outline-violet-600" onClick={() => onSelect(column.id)} aria-label={`Ver concepto: ${column.name}`}>{column.name}</button> : column.name}
      </li>)}
    </ul>
    <p className="mt-3 text-center text-xs text-slate-500">Una columna por concepto · misma escala · sin IVA{onSelect && <span className="block">Pulsa una barra o su leyenda para ver el desglose.</span>}<span className="block sm:hidden">Desliza el gráfico para ver todas las columnas.</span></p>
  </div>;
}
