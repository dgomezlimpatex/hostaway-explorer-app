import { Bar, BarChart, CartesianGrid, Rectangle, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { financialName, money, percent } from './financialFormat';
import { shortMoney } from './financialCharts';
import { FinancialTooltip } from './FinancialTooltip';

type Client = { id: string; name: string; result: number; margin: number | null; pending: number };
export function FinancialClientChart({ clients, metric, onClient }: { clients: Client[]; metric: 'result' | 'margin'; onClient: (id: string) => void }) {
  const rows = clients.map(client => ({ ...client, name: financialName(client.name), value: client[metric], conceptName: metric === 'result' ? 'Resultado' : 'Margen' }));
  const minimum = Math.min(0, ...rows.map(row => row.value || 0)), maximum = Math.max(0, ...rows.map(row => row.value || 0));
  const format = metric === 'result' ? money : percent;
  return <div className="mt-5 max-h-[480px] overflow-auto" aria-label="Gráfico de rentabilidad por cliente" tabIndex={0}>
    <div style={{ height: Math.max(170, rows.length * 52 + 45), minWidth: 420 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" accessibilityLayer={false} margin={{ left: 5, right: 30, top: 10, bottom: 5 }}>
          <CartesianGrid horizontal={false} strokeDasharray="4 4" stroke="#e2e8f0" />
          <XAxis type="number" domain={[minimum, maximum > minimum ? maximum : minimum + 1]} tickFormatter={metric === 'result' ? shortMoney : percent} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <YAxis dataKey="name" type="category" width={155} interval={0} tickFormatter={value => value.length > 24 ? `${value.slice(0, 23)}…` : value} tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} />
          <ReferenceLine x={0} stroke="#94a3b8" />
          <Tooltip content={<FinancialTooltip format={format} />} cursor={{ fill: '#f5f3ff' }} />
          <Bar dataKey="value" maxBarSize={22} isAnimationActive={false} shape={(props: { x?: number; y?: number; width?: number; height?: number; index?: number }) => {
            const row = rows[props.index || 0];
            if (!props.width || !props.height) return null;
            return <Rectangle x={props.x} y={props.y} width={props.width} height={props.height} radius={4} fill={(row.value || 0) < 0 ? '#e11d48' : '#7c3aed'}
              data-client-id={row.id} className="financial-client-column" role="button" tabIndex={0}
              aria-label={`Ver detalle de ${row.name} · ${format(row.value || 0)}${row.pending ? ' · Datos pendientes' : ''}`}
              onClick={() => onClient(row.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClient(row.id); } }} />;
          }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>;
}
