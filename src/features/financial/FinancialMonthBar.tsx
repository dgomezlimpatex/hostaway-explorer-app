import { useRef } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import './financialTheme.css';
import { financialMonthRange } from './financialView';
import { monthTitle, stripBars } from './financialMonthView';
import { money } from './financialFormat';

interface Props {
  start: string; end: string; annualYear: string; monthValue: string; filterCount: number; busy: boolean;
  rows: { start: string; result: number }[];
  onMove: (offset: number) => void; onPickMonth: (month: string) => void; onMonthInput: (month: string) => void;
  onFullMonth: () => void; onAnnual: () => void; onMonthly: () => void; filtersOpen: boolean; onToggleFilters: () => void; years: string[]; onYear: (year: string) => void;
}
const control = 'fin-focus inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--fin-line)] bg-[var(--fin-surface)] px-4 text-sm font-medium transition-colors hover:bg-[var(--fin-sunk)] disabled:opacity-50';

export function FinancialMonthBar({ start, end, annualYear, monthValue, filterCount, busy, rows, onMove, onPickMonth, onMonthInput, onFullMonth, onAnnual, onMonthly, filtersOpen, onToggleFilters, years, onYear }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const month = financialMonthRange(start.slice(0, 7));
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const partial = !annualYear && sameMonth && !monthValue;
  const status = annualYear ? 'Año completo' : monthValue ? 'Mes completo' : sameMonth && month ? (start === month.start ? `En curso · hasta el ${Number(end.slice(8))}` : 'Periodo personalizado') : 'Periodo personalizado';
  const label = annualYear || (sameMonth ? monthTitle(start) : `${start.split('-').reverse().join('/')} – ${end.split('-').reverse().join('/')}`);
  const bars = stripBars(rows, annualYear ? '' : start.slice(0, 7));
  return <div className="fin-rise space-y-3 lg:sticky lg:top-0 lg:z-30 lg:-mx-2 lg:bg-[var(--fin-bg)]/92 lg:px-2 lg:pb-2 lg:pt-1 lg:backdrop-blur" style={{ ['--i' as string]: 0 }} aria-label="Periodo del análisis" role="group">
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button type="button" className={`${control} !px-0 w-10`} aria-label={annualYear ? 'Año anterior' : 'Mes anterior'} onClick={() => onMove(-1)}><ChevronLeft aria-hidden className="h-4 w-4" /></button>
        <div className="min-w-0 text-center sm:text-left">
          <h2 className="fin-display text-[1.7rem] font-bold leading-none sm:text-4xl" aria-live="polite">{label}</h2>
          <p className="fin-muted mt-1 flex items-center justify-center gap-2 text-xs sm:justify-start">{status}{(partial || (!annualYear && !monthValue && sameMonth)) && month && <button type="button" onClick={onFullMonth} className="fin-focus rounded underline underline-offset-2">Ver mes completo</button>}</p>
        </div>
        <button type="button" className={`${control} !px-0 w-10`} aria-label={annualYear ? 'Año siguiente' : 'Mes siguiente'} onClick={() => onMove(1)}><ChevronRight aria-hidden className="h-4 w-4" /></button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {annualYear
          ? <select aria-label="Año del análisis" className={`${control} appearance-none`} value={annualYear} onChange={event => onYear(event.target.value)}>{years.map(year => <option key={year} value={year}>{year}</option>)}</select>
          : <><button type="button" className={control} onClick={() => input.current?.showPicker ? input.current.showPicker() : input.current?.focus()}><CalendarDays aria-hidden className="h-4 w-4" />Elegir mes</button>
            <input ref={input} type="month" tabIndex={-1} aria-label="Mes del análisis" className="sr-only" value={monthValue} onChange={event => onMonthInput(event.target.value)} /></>}
        <button type="button" className={`${control} ${annualYear ? '!border-[var(--fin-ink)] !bg-[var(--fin-ink)] !text-white' : ''}`} aria-pressed={!!annualYear} onClick={annualYear ? onMonthly : onAnnual}>{annualYear ? 'Vista Mensual' : 'Vista Anual'}</button>
        <button type="button" className={control} aria-expanded={filtersOpen} aria-controls="financial-filters" onClick={onToggleFilters}><SlidersHorizontal aria-hidden className="h-4 w-4" />Filtros{filterCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--fin-ink)] px-1 text-[11px] font-semibold text-white">{filterCount}</span>}</button>
      </div>
    </div>
    <div className={`grid grid-cols-12 gap-1 transition-opacity ${busy ? 'opacity-60' : ''}`} role="group" aria-label="Resultado de los últimos 12 meses">
      {bars.map(bar => <button key={bar.start} type="button" onClick={() => onPickMonth(bar.start.slice(0, 7))} aria-pressed={bar.selected}
        aria-label={`${monthTitle(bar.start)}: resultado ${money(bar.result)}`} title={`${monthTitle(bar.start)} · ${money(bar.result)}`}
        className="fin-focus group flex flex-col items-stretch gap-1 rounded-lg px-0.5 pb-1 pt-1 transition-colors hover:bg-[var(--fin-sunk)]">
        <span className="flex h-10 items-end justify-center" aria-hidden="true"><span className="fin-strip-bar w-full max-w-[1.6rem] rounded-t-[3px]" style={{ height: `${bar.height}%`, background: bar.negative ? 'var(--fin-loss)' : 'var(--fin-income)', opacity: bar.selected ? 1 : 0.38 }} /></span>
        <span className={`rounded-full text-center text-[10px] capitalize leading-5 sm:px-1 sm:text-[11px] ${bar.selected ? 'bg-[var(--fin-ink)] font-semibold text-white' : 'fin-muted'}`}>{bar.label}</span>
      </button>)}
    </div>
  </div>;
}
