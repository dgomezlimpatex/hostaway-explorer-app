import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Minus, TrendingDown, TrendingUp } from 'lucide-react';
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

// A part of a row (where the billing comes from, what personnel is made of).
export interface BreakdownPart { key: string; name: string; value: number; concept: string; linked?: boolean }
export type Breakdown = Partial<Record<'revenue' | 'personal', BreakdownPart[]>>;

function Waterfall({ total, periodStart, breakdown, focusConcept, onSelect }: { total: Summary; periodStart: string; breakdown: Breakdown; focusConcept?: string; onSelect: (concept: string) => void }) {
  const { rows, zero } = waterfallRows(total);
  const [ready, setReady] = useState(false);
  // Coming back from a detail opens the group that holds the concept to refocus.
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({ revenue: !!focusConcept && !!breakdown.revenue?.some(part => part.concept === focusConcept && part.linked) }));
  useEffect(() => { const frame = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(frame); }, []);
  return <ol className="fin-wf divide-y divide-[var(--fin-line)]" data-ready={ready} aria-label="Del ingreso al resultado">
    {rows.map((row, index) => {
      const parts = row.id === 'revenue' || row.id === 'personal' ? (breakdown[row.id] || []).filter(part => part.value !== 0) : [];
      return <li key={row.id} className="relative" style={{ ['--i' as string]: index }}>
        <button type="button" onClick={() => onSelect(row.id)} data-financial-concept={row.id} data-period-start={periodStart} aria-label={`${row.label} · ${signed(row)} · Ver desglose`}
          className={`fin-wf-row fin-focus grid w-full grid-cols-[minmax(5.5rem,8rem)_minmax(0,1fr)_auto] items-center gap-x-3 py-2.5 pl-1 text-left sm:gap-x-4 ${parts.length ? 'pr-9' : 'pr-1'}`}>
          <span className="min-w-0"><span className={`block text-[13px] leading-tight sm:text-sm ${row.kind === 'result' ? 'font-bold' : 'font-medium'}`}>{row.label}</span>
            {row.share !== null && <span className="fin-muted block text-[11px] leading-tight">{row.kind === 'result' ? `margen ${percent(row.share)}` : `${percent(row.share)} de ingresos`}</span>}</span>
          <span className="relative block h-6 rounded-sm bg-[var(--fin-sunk)]/55" aria-hidden="true">
            {zero !== null && <span className="absolute inset-y-[-3px] w-px bg-[var(--fin-ink)]/50" style={{ left: `${zero}%` }} />}
            <span className="fin-wf-bar absolute inset-y-0 rounded-[3px]" data-origin={row.origin} style={{ left: `${row.left}%`, width: `${row.width}%`, background: barColor(row) }} />
          </span>
          <span className={`fin-display text-right text-[15px] tabular-nums sm:text-base ${row.kind === 'result' ? 'font-bold' : 'font-semibold'}`} style={row.kind === 'result' ? { color: row.amount < 0 ? 'var(--fin-loss)' : 'var(--fin-gain)' } : undefined}>{signed(row)}</span>
        </button>
        {parts.length > 0 && <button type="button" aria-expanded={!!open[row.id]} aria-label={`${open[row.id] ? 'Ocultar' : 'Ver'} composición de ${row.label}`} onClick={() => setOpen(current => ({ ...current, [row.id]: !current[row.id] }))}
          className="fin-focus absolute right-0 top-2.5 grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--fin-sunk)]"><ChevronDown aria-hidden className={`h-4 w-4 transition-transform duration-300 ${open[row.id] ? 'rotate-180' : ''}`} /></button>}
        {parts.length > 0 && open[row.id] && <ul className="fin-rise mb-3 ml-3 space-y-0.5 border-l-2 border-[var(--fin-line)] pl-3" aria-label={`Composición de ${row.label}`}>{parts.map(part => <li key={part.key}>
          <button type="button" onClick={() => onSelect(part.concept)} {...(part.linked ? { 'data-financial-concept': part.concept, 'data-period-start': periodStart } : {})} aria-label={`${part.name} · ${money(part.value)} · Ver desglose`}
            className="fin-focus flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-[var(--fin-sunk)]">
            <span className="min-w-0 break-words">{part.name}</span><span className="shrink-0 tabular-nums"><strong className="font-semibold">{money(part.value)}</strong><span className="fin-muted"> · {percent(row.amount ? part.value / row.amount * 100 : 0)}</span></span></button></li>)}</ul>}
      </li>;
    })}
  </ol>;
}

export interface MonthHeroProps {
  total: Summary; previous: Summary | null; comparisonLabel: string | null; start: string; singleMonth: boolean; partial: boolean;
  onDetails: (concept: string) => void; breakdown?: Breakdown; focusConcept?: string; children?: ReactNode;
}
export function FinancialMonthHero({ total, previous, comparisonLabel, start, singleMonth, partial, onDetails, breakdown = {}, focusConcept, children }: MonthHeroProps) {
  const headline = monthHeadline({ total, previous, start, singleMonth, partial, comparisonLabel });
  const shownRevenue = useCountUp(total.revenue), shownProfit = useCountUp(total.result);
  const profitColor = headline.tone === 'loss' ? 'var(--fin-loss)' : 'var(--fin-gain)';
  const TrendIcon = headline.tone === 'loss' ? TrendingDown : TrendingUp;
  const deltaColor = (direction: string | null) => direction === 'worse' ? 'var(--fin-loss)' : direction === 'better' ? 'var(--fin-gain)' : 'var(--fin-muted)';
  const deltaIcon = (direction: string | null, now: number, before: number | undefined) => direction === 'same' || !direction ? Minus : now - (before ?? 0) > 0 ? ArrowUpRight : ArrowDownRight;
  const RevenueIcon = deltaIcon(headline.revenueDirection, total.revenue, previous?.revenue), ProfitIcon = deltaIcon(headline.profitDirection, total.result, previous?.result);
  const chip = 'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-medium tabular-nums';
  return <section aria-label="Comparativa del periodo" className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-surface)] p-5 sm:p-8">
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
      <div className="fin-rise" style={{ ['--i' as string]: 0 }}>
        <div className="flex items-start justify-between gap-3"><p className="fin-muted text-sm font-medium">{headline.kicker} · sin IVA</p>
          <FinancialHelp section="Comparativa del periodo"><p>Facturación, gastos y beneficio en la misma escala y sin IVA. Pulsa una fila para abrir su desglose.</p>
            <p aria-label="Desglose de Personal">Personal incluye <strong>{money(total.costs.personal)}</strong> de actividad y otros costes de personal, más <strong>{money(total.costs.salary)}</strong> de dirección y estructura.</p>
            <p>Gastos generales incluidos una vez, según la opción de reparto seleccionada.</p></FinancialHelp></div>
        <p className="fin-display mt-2 text-[clamp(2.6rem,7.2vw,4.75rem)] font-bold leading-[0.95]" aria-hidden="true">{money(shownRevenue)}</p>
        <p className="sr-only">Facturación: {headline.revenue}</p>
        {headline.revenueCompare && <p className="mt-3"><span className={chip} style={{ background: 'var(--fin-sunk)', color: deltaColor(headline.revenueDirection) }}><RevenueIcon aria-hidden className="h-4 w-4" />{headline.revenueCompare}</span></p>}
        <div className="mt-6 border-t border-[var(--fin-line)] pt-5">
          <p className="fin-muted text-sm font-medium">Beneficio</p>
          <p className="fin-display mt-1 flex items-center gap-2 text-[clamp(1.9rem,4.6vw,2.9rem)] font-bold leading-none" style={{ color: profitColor }} aria-hidden="true"><TrendIcon aria-hidden className="h-7 w-7 shrink-0" />{money(shownProfit)}</p>
          <p className="sr-only">Beneficio: {headline.profit}{headline.tone === 'loss' ? ' (resultado negativo)' : ''}</p>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed">{headline.sentence}</p>
          {headline.profitCompare && <p className="mt-2"><span className={chip} style={{ background: 'var(--fin-sunk)', color: deltaColor(headline.profitDirection) }}><ProfitIcon aria-hidden className="h-4 w-4" />Beneficio {headline.profitCompare}</span></p>}
        </div>
        {children}
      </div>
      <div className="fin-rise" style={{ ['--i' as string]: 1 }}><Waterfall total={total} periodStart={start} breakdown={breakdown} focusConcept={focusConcept} onSelect={onDetails} /></div>
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
