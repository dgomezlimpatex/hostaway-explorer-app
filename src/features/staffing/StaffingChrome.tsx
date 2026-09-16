import { useEffect, useRef, type ReactNode } from 'react';
import { fieldClass, fullDate, hours, panelClass, shortDate } from './presentation';
import type { StaffingWeek } from './types';

export function StaffingHeader({ sedeName, dateFrom, dateTo, children }: { sedeName?: string; dateFrom: string; dateTo: string; children?: ReactNode }) {
  return <header className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-5"><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Previsión de personal</h1><p className="mt-2 text-sm text-stone-600">{sedeName || 'Sede seleccionada'} · {fullDate(dateFrom)} — {fullDate(dateTo)}</p></div><div className="flex flex-wrap items-end gap-2">{children}</div></header>;
}

export function StaffingPanel({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; const trigger = document.activeElement; dialog?.showModal(); return () => { dialog?.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); }; }, []);
  return <dialog ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} className="fixed inset-0 !m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-white p-0 text-stone-900 backdrop:bg-black/30 sm:left-auto sm:w-[560px] sm:shadow-xl">
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white p-4"><h2 className="text-xl font-semibold">{title}</h2><button type="button" className={fieldClass} onClick={onClose} aria-label={`Cerrar ${title}`}>Cerrar</button></div><div className="space-y-5 p-4 sm:p-6">{children}</div>
  </dialog>;
}

export function StaffingEvolution({ weeks, selectedWeek, onSelect }: { weeks: StaffingWeek[]; selectedWeek?: string; onSelect: (week: string) => void }) {
  const max = Math.max(60, ...weeks.flatMap(week => [week.knownMinutes + week.estimatedMinutes, week.capacityMinutes]));
  const width = Math.max(660, weeks.length * 75);
  const x = (index: number) => 60 + index * ((width - 90) / Math.max(1, weeks.length));
  const y = (value: number) => 240 - value / max * 200;
  return <section className={panelClass} aria-label="Evolución semanal"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Evolución semanal</h2><p className="text-xs text-stone-600">Horas-persona · total de sede</p></div>
    <p className="mt-2 text-xs text-stone-600">Selecciona una semana. Desliza horizontalmente para ver todo el periodo.</p>
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-stone-700"><span>■ Carga registrada</span><span>▨ Estimación adicional</span><span>― Capacidad potencial</span></div>
    {!weeks.length ? <p role="status" className="py-12 text-center text-stone-600">Sin semanas calculables</p> : <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Gráfico semanal desplazable"><svg viewBox={`0 0 ${width} 310`} style={{ minWidth: width }} className="w-full" role="group" aria-label="Carga registrada, estimación tramada y capacidad potencial por semana">
      <defs><pattern id="staffing-estimate" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#ede7f6"/><path d="M-1 1l2-2M0 6l6-6M5 7l2-2" stroke="#7858a8" strokeWidth="1.5"/></pattern></defs>
      {[0, .25, .5, .75, 1].map(tick => <g key={tick}><line x1="49" x2={width - 10} y1={y(max * tick)} y2={y(max * tick)} stroke="#e7e5e4"/><text x="43" y={y(max * tick) + 4} textAnchor="end" fontSize="11" fill="#57534e">{hours(max * tick)}</text></g>)}
      {weeks.map((week, index) => <g key={week.week} role="button" tabIndex={0} aria-pressed={week.week === selectedWeek} aria-label={`Semana ${shortDate(week.week)}: ${hours(week.knownMinutes + week.estimatedMinutes)} previstas, ${hours(week.capacityMinutes)} capacidad`} onClick={() => onSelect(week.week)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(week.week); } }} className="cursor-pointer focus:outline focus:outline-2 focus:outline-[#310984]">
        <rect x={x(index) - 6} y="25" width="62" height="258" rx="4" fill={week.week === selectedWeek ? '#f3eff8' : 'transparent'} stroke={week.week === selectedWeek ? '#310984' : 'transparent'}/>
        <rect x={x(index) + 9} y={y(week.knownMinutes)} width="30" height={week.knownMinutes / max * 200} fill="#310984"/>
        <rect x={x(index) + 9} y={y(week.knownMinutes + week.estimatedMinutes)} width="30" height={week.estimatedMinutes / max * 200} fill="url(#staffing-estimate)"/>
        <text x={x(index) + 24} y="266" textAnchor="middle" fontSize="12" fill="#292524">{shortDate(week.week)}</text>
        {(index === 0 || week.week.slice(0, 7) !== weeks[index - 1].week.slice(0, 7)) && <text x={x(index) + 24} y="300" textAnchor="middle" fontSize="12" fill="#57534e">{new Date(`${week.week}T12:00:00Z`).toLocaleDateString('es-ES', { month: 'short', timeZone: 'Europe/Madrid' })}</text>}
      </g>)}
      <polyline points={weeks.map((week, index) => `${x(index) + 24},${y(week.capacityMinutes)}`).join(' ')} fill="none" stroke="#44403c" strokeWidth="2.5" pointerEvents="none"/>
    </svg></div>}
  </section>;
}
