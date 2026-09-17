import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, Check, MapPin } from 'lucide-react';
import { fieldClass, fullDate, hours, panelClass, shortDate } from './presentation';
import type { StaffingWeek } from './types';
import type { StaffingMonth } from './monthly';

export function StaffingHeader({ sedeName, dateFrom, dateTo, demo = false, children }: { sedeName?: string; dateFrom: string; dateTo: string; demo?: boolean; children?: ReactNode }) {
  return <header className="rounded-2xl bg-white px-4 py-5 shadow-[0_10px_30px_rgba(57,11,146,0.08)] sm:px-7 sm:py-6">
    <div className="flex flex-wrap items-start justify-between gap-6">
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#390b92] text-sm font-bold tracking-tight text-white">L·</div>
        <div className="min-w-0 border-l border-[#e8e1f2] pl-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#390b92]">LIMPATEX / PLANIFICACIÓN</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#201936] sm:text-[30px]">Previsión de personal</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#6c6579]"><span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#390b92]" />{sedeName || 'Sede seleccionada'}</span><span className="hidden text-[#d6d0df] sm:inline">•</span><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-[#390b92]" />{fullDate(dateFrom)} — {fullDate(dateTo)}</span><span className="rounded-full bg-[#f0ebfa] px-2.5 py-1 text-xs font-semibold text-[#390b92]">{demo ? 'Datos sintéticos' : 'Datos reales'}</span></div>
        </div>
      </div>
      <div className="flex max-w-full flex-wrap items-end gap-2 [&_label]:text-[11px] [&_label]:font-semibold [&_label]:uppercase [&_label]:tracking-wide [&_label]:text-[#716a7d]">{children}</div>
    </div>
  </header>;
}

export function StaffingPanel({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; const trigger = document.activeElement; dialog?.showModal(); return () => { dialog?.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); }; }, []);
  return <dialog ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} className="fixed inset-0 !m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-[#f8f7fb] p-0 text-[#201936] backdrop:bg-[#1b122f]/35 sm:left-auto sm:w-[560px] sm:shadow-2xl">
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#e3deed] bg-white p-4"><h2 className="text-xl font-bold">{title}</h2><button type="button" className={fieldClass} onClick={onClose} aria-label={`Cerrar ${title}`}>Cerrar</button></div><div className="space-y-5 p-4 sm:p-6">{children}</div>
  </dialog>;
}

type ChartBar = { key: string; label: string; knownMinutes: number; estimatedMinutes: number; capacityMinutes: number; selected: boolean; incomplete: boolean; week?: string };

export function StaffingEvolution({ weeks, months = [], selectedMonth, selectedWeek, onSelect, onMonth, incompleteWeeks = new Set<string>() }: { weeks: StaffingWeek[]; months?: StaffingMonth[]; selectedMonth?: string; selectedWeek?: string; onSelect: (week: string) => void; onMonth?: (month: string) => void; incompleteWeeks?: Set<string> }) {
  const [view, setView] = useState<'weeks' | 'months'>('weeks');
  const monthBars: ChartBar[] = months.map(month => ({ key: month.month, label: month.label, knownMinutes: month.knownMinutes, estimatedMinutes: month.estimatedMinutes, capacityMinutes: month.capacityMinutes, selected: month.month === selectedMonth, incomplete: month.status === 'future' && month.estimatedMinutes === 0, week: month.weeks.find(segment => segment.week >= month.startDate)?.week }));
  const weekBars: ChartBar[] = weeks.map(week => ({ key: week.week, label: shortDate(week.week), knownMinutes: week.knownMinutes, estimatedMinutes: week.estimatedMinutes, capacityMinutes: week.capacityMinutes, selected: week.week === selectedWeek, incomplete: incompleteWeeks.has(week.week), week: week.week }));
  const bars = view === 'months' && monthBars.length ? monthBars : weekBars;
  const max = Math.max(60, ...bars.flatMap(bar => [bar.knownMinutes + bar.estimatedMinutes, bar.capacityMinutes]));
  const width = Math.max(720, bars.length * 88);
  const x = (index: number) => 68 + index * ((width - 108) / Math.max(1, bars.length));
  const y = (value: number) => 245 - value / max * 190;
  const selectBar = (bar: ChartBar) => { if (view === 'months') { onMonth?.(bar.key); return; } if (bar.week) onSelect(bar.week); };
  return <section className={`${panelClass} overflow-hidden`} aria-label="Evolución semanal">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#390b92]">Carga y capacidad</p><h2 className="mt-1 text-xl font-bold tracking-tight text-[#201936]">Trabajo y capacidad por semana</h2><p className="mt-1 text-sm text-[#716a7d]">Selecciona una semana para ver el detalle</p></div><div className="inline-flex rounded-lg border border-[#ddd6ea] bg-[#faf9fc] p-1" role="group" aria-label="Periodo del gráfico"><button type="button" onClick={() => setView('weeks')} aria-pressed={view === 'weeks'} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === 'weeks' ? 'bg-[#390b92] text-white shadow-sm' : 'text-[#716a7d]'}`}>Semanas</button><button type="button" onClick={() => setView('months')} aria-pressed={view === 'months'} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === 'months' ? 'bg-[#390b92] text-white shadow-sm' : 'text-[#716a7d]'}`}>Meses</button></div></div>
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-[#eeeaf4] py-3 text-xs text-[#625b70]"><span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-[#390b92]" />Trabajo registrado</span><span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm border border-[#8667b0] bg-[#eee8f7]" />Estimación adicional</span><span className="inline-flex items-center gap-2"><i className="h-0.5 w-4 bg-[#4c4658]" />Capacidad del equipo</span>{incompleteWeeks.size > 0 && <span className="inline-flex items-center gap-2 text-[#8a5b08]"><i className="h-3 w-3 rounded-sm bg-[#fff4d9]" />Previsión pendiente</span>}</div>
    {!bars.length ? <p role="status" className="py-12 text-center text-[#716a7d]">Sin semanas calculables</p> : <div className="mt-2 overflow-x-auto rounded-lg bg-[#fdfcff]" tabIndex={0} role="region" aria-label="Gráfico de carga y capacidad desplazable"><svg viewBox={`0 0 ${width} 330`} style={{ minWidth: width }} className="w-full" role="group" aria-label="Carga registrada, estimación y capacidad por periodo">
      <defs><pattern id="staffing-estimate" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#eee8f7" /><path d="M-2 2l4-4M0 7L7 0M5 9l4-4" stroke="#8667b0" strokeWidth="1.5" /></pattern></defs>
      {[0, .25, .5, .75, 1].map(tick => <g key={tick}><line x1="55" x2={width - 16} y1={y(max * tick)} y2={y(max * tick)} stroke="#ebe7f0" /><text x="48" y={y(max * tick) + 4} textAnchor="end" fontSize="11" fill="#817a8c">{hours(max * tick)}</text></g>)}
      {bars.map((bar, index) => <g key={bar.key} role="button" tabIndex={bar.week ? 0 : -1} aria-pressed={bar.selected} aria-label={`${bar.label}: ${hours(bar.knownMinutes + bar.estimatedMinutes)} previstas, ${hours(bar.capacityMinutes)} capacidad`} onClick={() => selectBar(bar)} onKeyDown={event => { if (bar.week && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectBar(bar); } }} className={bar.week ? 'cursor-pointer focus:outline focus:outline-2 focus:outline-[#390b92]' : ''}>
        <rect x={x(index) - 8} y="30" width="72" height="258" rx="8" fill={bar.selected ? '#f1ebfb' : bar.incomplete ? '#fffaf0' : 'transparent'} stroke={bar.selected ? '#390b92' : 'transparent'} />
        {bar.knownMinutes + bar.estimatedMinutes > 0 && <text x={x(index) + 28} y={Math.max(19, y(bar.knownMinutes + bar.estimatedMinutes) - 8)} textAnchor="middle" fontSize="11" fontWeight="600" fill="#4b4457">{hours(bar.knownMinutes + bar.estimatedMinutes)}</text>}
        <rect x={x(index) + 13} y={y(bar.knownMinutes)} width="30" height={bar.knownMinutes / max * 190} rx="3" fill="#390b92" />
        <rect x={x(index) + 13} y={y(bar.knownMinutes + bar.estimatedMinutes)} width="30" height={bar.estimatedMinutes / max * 190} rx="3" fill="url(#staffing-estimate)" />
        {bar.selected && <g><rect x={x(index) - 3} y="12" width="62" height="20" rx="10" fill="#390b92" /><text x={x(index) + 28} y="26" textAnchor="middle" fontSize="10" fontWeight="700" fill="white">Seleccionada</text></g>}
        <text x={x(index) + 28} y="272" textAnchor="middle" fontSize="11" fill="#4f485b">{bar.label}</text>
        {view === 'weeks' && (index === 0 || bars[index - 1].key.slice(0, 7) !== bar.key.slice(0, 7)) && <text x={x(index) + 28} y="307" textAnchor="middle" fontSize="11" fontWeight="600" fill="#817a8c">{new Date(`${bar.key}T12:00:00Z`).toLocaleDateString('es-ES', { month: 'short', timeZone: 'Europe/Madrid' })}</text>}
      </g>)}
      <polyline points={bars.map((bar, index) => `${x(index) + 28},${y(bar.capacityMinutes)}`).join(' ')} fill="none" stroke="#4c4658" strokeWidth="2.5" pointerEvents="none" />
    </svg></div>}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#817a8c]"><span>{view === 'weeks' ? 'Selecciona una semana para ver el detalle.' : 'Selecciona un mes para saltar a su primera semana.'}</span>{view === 'weeks' && bars.length > 6 && <span className="font-semibold text-[#625b70]">Desliza para ver más semanas →</span>}{bars.some(bar => bar.selected) && <span className="inline-flex items-center gap-1.5 font-semibold text-[#390b92]"><Check className="h-3.5 w-3.5" />Periodo seleccionado</span>}</div>
  </section>;
}
