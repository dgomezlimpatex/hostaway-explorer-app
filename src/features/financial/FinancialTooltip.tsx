import { money } from './financialFormat';

export function FinancialTooltip({ active, payload, label, format = money }: {
  active?: boolean; label?: string | number; format?: (value: number) => string;
  payload?: readonly { name?: string | number; value?: unknown; color?: string; payload?: { conceptName?: string; periodLabel?: string; fill?: string } }[];
}) {
  if (!active || !payload?.length) return null;
  return <div role="tooltip" className="rounded-xl border border-violet-100 bg-white p-3 text-sm shadow-lg">
    <p className="mb-2 font-semibold text-slate-700">{payload[0].payload?.periodLabel || label}</p>
    {payload.map((item, index) => <p key={index} className="recharts-tooltip-item flex items-center gap-2 tabular-nums">
      <span className="h-2 w-2 rounded-sm" style={{ background: item.color || item.payload?.fill }} />
      <span>{item.payload?.conceptName || item.name}: <strong>{format(Number(item.value))}</strong></span>
    </p>)}
  </div>;
}
