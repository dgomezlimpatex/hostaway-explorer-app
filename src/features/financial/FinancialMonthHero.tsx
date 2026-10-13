import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Info, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import './financialTheme.css';
import { loadFinancialFont } from './financialFont';
import { money, percent } from './financialFormat';
import { FinancialHelp } from './FinancialHelp';
import { monthHeadline, waterfallRows, type WaterfallRow } from './financialMonthView';
import type { Summary } from './financialModel';

loadFinancialFont();
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Counts from the last shown value to the new one. The exact figure is always
// available to assistive tech and to the layout through the hidden twin.
function useCountUp(target: number, duration = 720) {
  const [value, setValue] = useState(() => reducedMotion() ? target : 0);
  const from = useRef(value);
  useEffect(() => {
    if (reducedMotion()) { setValue(target); from.current = target; return; }
    const start = from.current, began = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - began) / duration), eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(start + (target - start) * eased);
      from.current = next; setValue(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

const barColor = (row: WaterfallRow) => row.kind === 'income' ? 'var(--fin-income)' : row.kind === 'expense' ? 'var(--fin-expense)' : row.amount < 0 ? 'var(--fin-loss)' : 'var(--fin-gain)';
const signed = (row: WaterfallRow) => row.kind === 'expense' && row.amount !== 0 ? `−${money(Math.abs(row.amount))}` : money(row.amount);

function Waterfall({ total, periodStart, onSelect }: { total: Summary; periodStart: string; onSelect: (concept: string) => void }) {
  const { rows, zero } = waterfallRows(total);
  const [ready, setReady] = useState(false);
  useEffect(() => { const frame = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(frame); }, []);
  return <ol className="fin-wf divide-y divide-[var(--fin-line)]" data-ready={ready} aria-label="Del ingreso al resultado">
    {rows.map((row, index) => <li key={row.id} style={{ ['--i' as string]: index }}>
      <button type="button" onClick={() => onSelect(row.id)} data-financial-concept={row.id} data-period-start={periodStart} aria-label={`${row.label} · ${signed(row)} · Ver desglose`}
        className="fin-wf-row fin-focus grid w-full grid-cols-[minmax(5.5rem,8rem)_minmax(0,1fr)_auto] items-center gap-x-3 px-1 py-2.5 text-left sm:gap-x-4">
        <span className="min-w-0"><span className={`block text-[13px] leading-tight sm:text-sm ${row.kind === 'result' ? 'font-bold' : 'font-medium'}`}>{row.label}</span>
          {row.share !== null && <span className="fin-muted block text-[11px] leading-tight">{row.kind === 'result' ? `margen ${percent(row.share)}` : `${percent(row.share)} de ingresos`}</span>}</span>
        <span className="relative block h-6 rounded-sm bg-[var(--fin-sunk)]/55" aria-hidden="true">
          {zero !== null && <span className="absolute inset-y-[-3px] w-px bg-[var(--fin-ink)]/50" style={{ left: `${zero}%` }} />}
          <span className="fin-wf-bar absolute inset-y-0 rounded-[3px]" data-origin={row.origin} style={{ left: `${row.left}%`, width: `${row.width}%`, background: barColor(row) }} />
        </span>
        <span className={`fin-display text-right text-[15px] tabular-nums sm:text-base ${row.kind === 'result' ? 'font-bold' : 'font-semibold'}`} style={row.kind === 'result' ? { color: row.amount < 0 ? 'var(--fin-loss)' : 'var(--fin-gain)' } : undefined}>{signed(row)}</span>
      </button>
    </li>)}
  </ol>;
}

export interface MonthHeroProps {
  total: Summary; previous: Summary | null; comparisonLabel: string | null; start: string; singleMonth: boolean; partial: boolean;
  partialCategories: boolean; onDetails: (concept: string) => void; children?: ReactNode;
}
export function FinancialMonthHero({ total, previous, comparisonLabel, start, singleMonth, partial, partialCategories, onDetails, children }: MonthHeroProps) {
  const headline = monthHeadline({ total, previous, start, singleMonth, partial, comparisonLabel });
  const shown = useCountUp(total.result);
  const color = headline.tone === 'loss' ? 'var(--fin-loss)' : 'var(--fin-gain)';
  const TrendIcon = headline.tone === 'loss' ? TrendingDown : TrendingUp;
  const CompareIcon = headline.direction === 'same' || !headline.direction ? Minus : (total.result - (previous?.result ?? 0)) > 0 ? ArrowUpRight : ArrowDownRight;
  return <section aria-label="Comparativa del periodo" className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-surface)] p-5 sm:p-8">
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
      <div className="fin-rise" style={{ ['--i' as string]: 0 }}>
        <div className="flex items-start justify-between gap-3"><p className="fin-muted text-sm font-medium">{headline.kicker} · sin IVA</p>
          <FinancialHelp section="Comparativa del periodo"><p>Ingresos y gastos en la misma escala y sin IVA. Pulsa una fila para abrir su desglose.</p>
            <p aria-label="Desglose de Personal">Personal incluye <strong>{money(total.costs.personal)}</strong> de actividad y otros costes de personal, más <strong>{money(total.costs.salary)}</strong> de dirección y estructura.</p>
            <p>Gastos generales incluidos una vez, según la opción de reparto seleccionada.</p></FinancialHelp></div>
        <p className="fin-display mt-2 text-[clamp(2.6rem,7.2vw,4.75rem)] font-bold leading-[0.95]" style={{ color }} aria-hidden="true">{money(shown)}</p>
        <p className="sr-only">Resultado: {money(total.result)}</p>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed">{headline.sentence}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold" style={{ background: 'var(--fin-sunk)', color }}><TrendIcon aria-hidden className="h-4 w-4" />{headline.tone === 'loss' ? 'Resultado negativo' : headline.tone === 'flat' ? 'Resultado a cero' : 'Resultado positivo'}</span>
          {headline.compare && <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium tabular-nums" style={{ background: 'var(--fin-sunk)', color: headline.direction === 'worse' ? 'var(--fin-loss)' : headline.direction === 'better' ? 'var(--fin-gain)' : 'var(--fin-muted)' }}>
            <CompareIcon aria-hidden className="h-4 w-4" />{headline.compare}</span>}
          <span className="fin-muted inline-flex items-center gap-1.5 rounded-full border border-[var(--fin-line)] px-3 py-1"><Info aria-hidden className="h-3.5 w-3.5" />{partialCategories ? 'Parcial · provisional' : 'Provisional'}</span>
        </div>
        {children}
      </div>
      <div className="fin-rise" style={{ ['--i' as string]: 1 }}><Waterfall total={total} periodStart={start} onSelect={onDetails} /></div>
    </div>
  </section>;
}

export function FinancialSummarySkeleton() {
  return <div role="status" aria-label="Cargando servicios y costes…" className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-surface)] p-5 sm:p-8">
    <span className="sr-only">Cargando servicios y costes…</span>
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
      <div className="space-y-4"><div className="fin-skeleton h-4 w-40" /><div className="fin-skeleton h-16 w-3/4" /><div className="fin-skeleton h-4 w-2/3" /><div className="fin-skeleton h-8 w-1/2 rounded-full" /></div>
      <div className="space-y-4">{[96, 14, 22, 9, 6, 70].map((width, index) => <div key={index} className="flex items-center gap-4"><div className="fin-skeleton h-4 w-24" /><div className="fin-skeleton h-6" style={{ width: `${width}%`, maxWidth: 'calc(100% - 9rem)' }} /></div>)}</div>
    </div>
  </div>;
}
