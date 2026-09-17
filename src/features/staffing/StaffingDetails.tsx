import { useEffect, useMemo, useRef, useState } from 'react';
import type { StaffingDataset, StaffingDay, StaffingIssue, StaffingResult } from './types';
import { StaffingPanel } from './StaffingChrome';
import { clock, fieldClass, hours, informationalIssues, knownUncovered, shortDate, weekdays } from './presentation';

const PAGE_SIZE = 7;
const estimateStyle = { backgroundImage: 'repeating-linear-gradient(135deg,#9376ba 0 2px,#e9e0f4 2px 5px)' };
export function StaffingDetails({ dataset, result, week, days, issues, centerFilter, onCenter, onSimulate }: { dataset: StaffingDataset; result: StaffingResult; week?: string; days: StaffingDay[]; issues: StaffingIssue[]; centerFilter: string; onCenter: (id: string) => void; onSimulate: () => void }) {
  const [view, setView] = useState('Días');
  const [dayId, setDayId] = useState('');
  const [search, setSearch] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);
  const [page, setPage] = useState(0);
  const [originPage, setOriginPage] = useState(0);
  const [detail, setDetail] = useState<'services' | 'team' | null>(null);
  const [teamSearch, setTeamSearch] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);
  const focusLinkedCell = useRef(false);
  const selectedDay = days.find(day => day.date === dayId) || days[0];
  const centerName = (id: string) => dataset.centers.find(center => center.id === id)?.name || 'Centro no resuelto';
  const workerName = (id: string) => dataset.workers.find(worker => worker.id === id)?.name || 'Persona';
  // The result has no day/center estimate or capacity. Show known input effort,
  // reconcile against daily output, and never invent a distribution of estimates.
  const loads = useMemo(() => {
    const map = new Map<string, number>();
    for (const service of dataset.services) {
      if (!Number.isFinite(service.personMinutes) || service.personMinutes <= 0) continue;
      const key = `${service.date}:${service.centerId}`;
      map.set(key, (map.get(key) || 0) + service.personMinutes);
    }
    return map;
  }, [dataset.services]);
  const load = (id: string, date: string) => loads.get(`${date}:${id}`) || 0;
  const partial = (id?: string) => issues.some(issue => !informationalIssues.has(issue.code) && (!id || !issue.centerId || issue.centerId === id));
  const centerIssue = (id: string) => issues.some(issue => !informationalIssues.has(issue.code) && issue.centerId === id);
  const reconciled = (day: StaffingDay) => Math.abs(dataset.centers.reduce((sum, center) => sum + load(center.id, day.date), 0) - day.knownMinutes) < 0.01;
  const shownLoad = (id: string, day: StaffingDay) => reconciled(day) ? hours(load(id, day.date)) : '—';
  const centers = dataset.centers.map(center => ({ ...center, total: days.reduce((sum, day) => sum + load(center.id, day.date), 0) }))
    .filter(center => center.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')) && (showEmpty || center.total > 0 || centerIssue(center.id)))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'));
  const pageCount = Math.max(1, Math.ceil(centers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = centers.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const origins = selectedDay ? dataset.centers.map(center => ({ ...center, minutes: load(center.id, selectedDay.date) })).filter(center => center.minutes > 0 || centerIssue(center.id)).sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name, 'es')) : [];
  const originCount = Math.max(1, Math.ceil(origins.length / PAGE_SIZE));
  const currentOriginPage = Math.min(originPage, originCount - 1);
  const maximum = Math.max(1, ...days.flatMap(day => [day.knownMinutes + day.estimatedMinutes, day.capacityMinutes]));
  const heatMaximum = Math.max(1, ...dataset.centers.flatMap(center => days.map(day => load(center.id, day.date))));
  const chooseDay = (date: string) => { setDayId(date); setOriginPage(0); };
  const selectedCenter = dataset.centers.find(center => center.id === centerFilter);
  const centerWeek = result.centers.find(cell => cell.centerId === centerFilter && cell.week === week);
  const services = dataset.services.filter(service => service.date === selectedDay?.date && (view === 'Días' || service.centerId === centerFilter));
  useEffect(() => {
    if (view !== 'Centros' || !focusLinkedCell.current) return;
    const button = mapRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if (button) { button.focus({ preventScroll: true }); button.scrollIntoView({ block: 'nearest', inline: 'nearest' }); focusLinkedCell.current = false; }
  }, [view, centerFilter, selectedDay?.date, currentPage]);
  const chooseCenter = (id: string, date: string) => {
    focusLinkedCell.current = true;
    onCenter(id); chooseDay(date); setView('Centros'); setSearch(''); setShowEmpty(true);
    const all = dataset.centers.map(center => ({ id: center.id, name: center.name, total: days.reduce((sum, day) => sum + load(center.id, day.date), 0) })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'));
    setPage(Math.floor(Math.max(0, all.findIndex(center => center.id === id)) / PAGE_SIZE));
  };
  return <section aria-label="Análisis diario y centros" className="min-w-0 rounded-xl border border-[#e3deed] bg-white p-4 shadow-[0_8px_24px_rgba(57,11,146,0.06)] sm:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eeeaf4] pb-4">
      <div><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#390b92]">Detalle semanal</p><h2 className="mt-1 text-xl font-bold tracking-tight text-[#201936]">{week ? `${shortDate(week)} – ${shortDate(days[days.length - 1]?.date)}` : 'Semana seleccionada'}</h2><p className="mt-1 text-sm text-[#716a7d]">Semana seleccionada · horas de trabajo de la sede</p></div>
      <div className="flex items-center gap-2"><div role="tablist" aria-label="Vistas de detalle" className="flex gap-1">{['Días', 'Centros'].map((tab, index, tabs) => <button key={tab} id={`staffing-tab-${tab}`} type="button" role="tab" aria-selected={view === tab} aria-controls="staffing-detail" tabIndex={view === tab ? 0 : -1} className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-bold ${view === tab ? 'bg-[#390b92] text-white' : 'border border-[#ddd6ea] bg-white text-[#716a7d]'}`} onClick={() => setView(tab)} onKeyDown={event => { if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index; setView(tabs[next]); document.getElementById(`staffing-tab-${tabs[next]}`)?.focus(); } }}>{tab}</button>)}</div><button type="button" className="inline-flex min-h-9 items-center rounded-lg border border-[#ddd6ea] px-3 text-xs font-bold text-[#390b92]" onClick={() => setDetail('team')}>Ver equipo</button></div>
    </header>
    {week && <div className="grid gap-2 border-b border-[#eeeaf4] py-4 sm:grid-cols-3"><div className="rounded-lg bg-[#faf9fc] p-3"><p className="text-xs font-semibold text-[#817a8c]">Trabajo previsto</p><p className="mt-1 text-xl font-bold tabular-nums text-[#201936]">{hours(days.reduce((total, day) => total + day.knownMinutes + day.estimatedMinutes, 0))}</p><p className="text-xs text-[#716a7d]">{hours(days.reduce((total, day) => total + day.knownMinutes, 0))} registrado · {hours(days.reduce((total, day) => total + day.estimatedMinutes, 0))} adicional</p></div><div className="rounded-lg bg-[#faf9fc] p-3"><p className="text-xs font-semibold text-[#817a8c]">Capacidad</p><p className="mt-1 text-xl font-bold tabular-nums text-[#201936]">{hours(days.reduce((total, day) => total + day.capacityMinutes, 0))}</p><p className="text-xs text-[#716a7d]">Horas del equipo calculada</p></div><div className="rounded-lg border border-[#f0dfb0] bg-[#fffaf0] p-3"><p className="text-xs font-semibold text-[#a46c00]">Diferencia agregada</p><p className="mt-1 text-xl font-bold tabular-nums text-[#a46c00]">{hours(Math.max(0, days.reduce((total, day) => total + day.knownMinutes + day.estimatedMinutes - day.capacityMinutes, 0)))}</p><p className="text-xs text-[#80621b]">No equivale a trabajo sin encajar</p></div></div>}
    <div className="grid min-w-0 gap-4 pt-3 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div id="staffing-detail" role="tabpanel" aria-labelledby={`staffing-tab-${view}`} className="min-w-0">
        {view === 'Días' ? <>
          <h2 className="text-base font-bold text-[#201936]">Dónde se concentra</h2>
          <p className="mb-3 mt-1 text-xs text-[#716a7d]">Trabajo registrado · trama: estimación adicional · línea: capacidad</p>
          <p className="mb-1 grid grid-cols-[54px_minmax(0,1fr)_72px_60px] gap-2 text-right text-xs text-[#817a8c]"><span /><span>Carga / capacidad</span><span>Sin encajar</span></p>
          <div aria-label="Barras diarias" className="space-y-1">{days.map(day => <button key={day.date} type="button" aria-label={`${shortDate(day.date)}: carga ${hours(day.knownMinutes + day.estimatedMinutes)}, el equipo puede hacer ${hours(day.capacityMinutes)}, sin repartir ${hours(knownUncovered(day))}`} aria-pressed={selectedDay?.date === day.date} onClick={() => chooseDay(day.date)} className={`grid w-full min-w-0 grid-cols-[54px_minmax(0,1fr)_72px_60px] items-center gap-2 rounded border px-2 py-2 text-left ${selectedDay?.date === day.date ? 'border-[#310984] bg-[#f3eff8]' : 'border-transparent hover:bg-stone-50'}`}>
            <span className="text-xs"><strong className="block">{weekdays[new Date(`${day.date}T12:00:00Z`).getUTCDay()].slice(0, 3)}</strong>{shortDate(day.date)}</span>
            <span className="grid min-w-0 gap-1" aria-hidden="true"><span className="flex h-3 overflow-hidden rounded-sm"><span className="bg-[#310984]" style={{ width: `${day.knownMinutes / maximum * 100}%` }}/><span style={{ ...estimateStyle, width: `${day.estimatedMinutes / maximum * 100}%` }}/></span><span className="h-1.5 rounded-sm bg-stone-400" style={{ width: `${day.capacityMinutes / maximum * 100}%` }}/></span>
            <span className="text-right text-xs tabular-nums"><strong className="block">{hours(day.knownMinutes + day.estimatedMinutes)}</strong><span className="text-stone-500">{hours(day.capacityMinutes)}</span></span><span className={`text-right text-xs font-semibold tabular-nums ${knownUncovered(day) > 0 ? 'text-[#b35300]' : 'text-[#817a8c]'}`}>{knownUncovered(day) > 0 ? hours(knownUncovered(day)) : '—'}</span>
          </button>)}</div>
          {days.some(day => knownUncovered(day) > 0) && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#f0dfb0] bg-[#fffaf0] px-3 py-2 text-xs text-[#80621b]"><span>{days.filter(day => knownUncovered(day) > 0).length} {days.filter(day => knownUncovered(day) > 0).length === 1 ? 'día' : 'días'} con servicios pendientes de encajar</span><button type="button" className="font-bold text-[#a46c00]" onClick={() => setDetail('services')}>Ver servicios y centros →</button></div>}
        </> : <>
          <div className="flex flex-wrap items-center gap-2"><input aria-label="Buscar centro" placeholder="Buscar centro" type="search" className={`${fieldClass} w-48`} value={search} onChange={event => { setSearch(event.target.value); setPage(0); }}/><label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={showEmpty} onChange={event => { setShowEmpty(event.target.checked); setPage(0); }}/>Mostrar sin actividad</label></div>
          <p className="my-2 text-xs text-stone-600">Trabajo ya registrado · intensidad relativa, no cobertura. Estimaciones sin reparto diario por centro.</p>
          <p className="mb-2 text-xs text-stone-500 sm:hidden">Desliza el mapa para ver los siete días →</p>
          <div ref={mapRef} className="max-w-full overflow-x-auto" role="region" aria-label="Mapa de carga por centro" tabIndex={0}><table className="w-full min-w-[520px] table-fixed border-separate border-spacing-1 text-xs"><caption className="sr-only">Centros por día · horas conocidas</caption><thead><tr><th className="w-32 text-left">Centro</th>{days.map(day => <th key={day.date} className="font-normal">{weekdays[new Date(`${day.date}T12:00:00Z`).getUTCDay()].slice(0, 2)}<span className="block text-stone-500">{shortDate(day.date)}</span></th>)}</tr></thead><tbody>{visible.map(center => <tr key={center.id}><th className="break-words pr-2 text-left font-medium">{center.name}</th>{days.map(day => {
            const minutes = load(center.id, day.date);
            const unknown = partial(center.id) || !reconciled(day);
            const active = selectedCenter?.id === center.id && selectedDay?.date === day.date;
            return <td key={day.date}><button type="button" aria-label={`${center.name}, ${shortDate(day.date)}: ${shownLoad(center.id, day)} conocidas${unknown ? ', parcial' : ''}`} aria-pressed={active} onClick={() => { onCenter(center.id); chooseDay(day.date); }} className={`min-h-11 w-full rounded border text-center tabular-nums ${active ? 'border-[#310984] ring-2 ring-[#310984]' : 'border-transparent'}`} style={{ backgroundColor: `rgba(49,9,132,${reconciled(day) && minutes ? 0.08 + 0.3 * minutes / heatMaximum : 0.025})` }}>{shownLoad(center.id, day)}{unknown && <span aria-hidden="true">*</span>}</button></td>;
          })}</tr>)}</tbody></table></div>
          {!centers.length && <p className="py-4 text-sm">No hay centros que coincidan con estos filtros.</p>}
          <nav aria-label="Páginas de centros" className="mt-2 flex items-center justify-between gap-2 text-xs"><button type="button" className={fieldClass} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>{centers.length} centros · {currentPage + 1}/{pageCount}</span><button type="button" className={fieldClass} disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Siguiente</button></nav>
          <p className="mt-2 text-xs text-[#817a8c]">* Parcial · Sin actividad no significa inactivo.</p>
        </>}
      </div>
      <aside aria-label="Resumen seleccionado" className={`min-w-0 border-t pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0 ${view === 'Días' ? 'hidden' : ''}`}>
        {selectedDay ? <>
          <h3 className="break-words text-sm font-semibold">{view === 'Centros' ? selectedCenter?.name || 'Selecciona un centro y día' : 'Origen de la carga'} · {shortDate(selectedDay.date)}</h3>
          {(partial(view === 'Centros' ? centerFilter : undefined) || !reconciled(selectedDay)) && <span className="mt-1 inline-block text-xs font-medium text-amber-800">Parcial · consultar Datos y criterios</span>}
          {!reconciled(selectedDay) && <p className="mt-2 text-xs text-amber-800">Carga por centro no conciliada con el cálculo; importes ocultos.</p>}
          {view === 'Días' ? <>
            <p className="mt-2 text-sm tabular-nums"><strong>{hours(selectedDay.knownMinutes)}</strong> conocidas · {hours(selectedDay.estimatedMinutes)} estimadas</p>
            <p className="mt-1 text-xs text-stone-600">El equipo puede hacer {hours(selectedDay.capacityMinutes)} · no garantiza encaje</p>
            <div className="mt-3 divide-y">{origins.slice(currentOriginPage * PAGE_SIZE, (currentOriginPage + 1) * PAGE_SIZE).map(center => <button key={center.id} type="button" aria-label={`Abrir ${center.name} el ${shortDate(selectedDay.date)}`} className="flex min-h-11 w-full items-center justify-between gap-2 py-2 text-left text-xs hover:text-[#310984]" onClick={() => chooseCenter(center.id, selectedDay.date)}><span className="min-w-0 break-words">{center.name}</span><strong className="shrink-0 tabular-nums">{shownLoad(center.id, selectedDay)} →</strong></button>)}</div>
            {!origins.length && <p className="my-3 text-xs">Sin carga conocida registrada.</p>}
            {originCount > 1 && <nav aria-label="Páginas de origen" className="flex items-center justify-between text-xs"><button type="button" className={fieldClass} disabled={!currentOriginPage} onClick={() => setOriginPage(currentOriginPage - 1)}>Anterior</button><span>{currentOriginPage + 1}/{originCount}</span><button type="button" className={fieldClass} disabled={currentOriginPage + 1 >= originCount} onClick={() => setOriginPage(currentOriginPage + 1)}>Siguiente</button></nav>}
            <p className="mt-2 text-xs text-stone-500">Estimadas: sin reparto diario por centro.</p>
            <p className="mt-2 text-xs">{hours(knownUncovered(selectedDay))} de trabajo conocido sin repartir.</p>
          </> : selectedCenter && <>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{shownLoad(selectedCenter.id, selectedDay)}</p><p className="text-xs text-stone-600">Trabajo ya registrado del día · {services.length} servicios</p>
            <p className="mt-3 text-xs">Semana del centro: {centerWeek ? hours(centerWeek.knownMinutes) : '—'} conocidas + {centerWeek ? hours(centerWeek.estimatedMinutes) : '—'} estimadas.</p>
            <p className="mt-2 text-xs text-stone-600">Sin capacidad atribuida al centro; equipo móvil de sede.</p>
          </>}
          {(view === 'Días' || selectedCenter) && <button type="button" className={`${fieldClass} mt-3 w-full`} onClick={() => setDetail('services')}>Ver servicios y libranzas</button>}
        </> : <p className="text-sm">Sin días calculables.</p>}
      </aside>
    </div>
    {detail === 'services' && selectedDay && <StaffingPanel title="Servicios y libranzas" onClose={() => setDetail(null)}><h3 className="font-semibold">{shortDate(selectedDay.date)} · {view === 'Días' ? 'Total de sede' : centerName(centerFilter)}</h3><p className="text-xs text-stone-600">Asignaciones simuladas, no cuadrante real. Estimaciones sin comprobar.</p><details><summary className="min-h-11 cursor-pointer py-3 text-sm">Libranzas de sede ({selectedDay.rests.length})</summary><p className="text-xs">{selectedDay.rests.map(rest => `${workerName(rest.workerId)}${rest.proposed ? ' (propuesta)' : ''}`).join(', ') || 'Sin libranzas registradas'}</p></details><ul className="divide-y text-sm">{services.map(service => <li key={service.id} className="py-3"><strong>{centerName(service.centerId)}</strong><p className="text-xs text-stone-600">{service.source === 'task' ? 'Tarea' : service.source === 'recurring' ? 'Recurrencia' : 'Reserva'} · {hours(service.personMinutes)} · {clock(service.startMinute)}–{clock(service.endMinute)}</p><p className="mt-1 text-xs">{selectedDay.assignments.filter(a => a.serviceId === service.id).map(a => `${clock(a.startMinute)}–${clock(a.endMinute)} ${workerName(a.workerId)}${a.support ? ' · apoyo' : ''}`).join(', ') || 'Sin asignación calculada'}</p></li>)}</ul>{!services.length && <p>Sin servicios registrados en este detalle.</p>}<details><summary className="min-h-11 cursor-pointer py-3 text-sm">Restricciones y resultado diario de sede ({selectedDay.reasons.length})</summary><ul className="space-y-2 break-words text-xs">{selectedDay.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></details></StaffingPanel>}
    {detail === 'team' && <StaffingPanel title="Equipo de sede" onClose={() => setDetail(null)}><button type="button" className={fieldClass} onClick={() => { setDetail(null); onSimulate(); }}>Editar en escenario</button><input type="search" aria-label="Buscar en equipo" placeholder="Buscar persona" className={fieldClass} value={teamSearch} onChange={event => setTeamSearch(event.target.value)}/><section><h3 className="border-b pb-2 font-semibold">Plantilla</h3><ul className="divide-y">{dataset.workers.filter(worker => worker.name.toLocaleLowerCase('es').includes(teamSearch.toLocaleLowerCase('es'))).map(worker => <li key={worker.id} className="py-3 text-sm"><strong>{worker.name}</strong><p className="text-xs text-stone-600">{worker.homeCenterIds.map(centerName).join(', ') || 'Sin centro habitual'}</p><p>{hours(worker.weeklyMinutes)}/semana · Horas de ficha</p><p className="text-xs text-stone-600">{worker.restDay == null ? 'Libranza sin confirmar' : `Libre ${weekdays[worker.restDay].toLowerCase()}`} · {worker.availability.length} franjas</p></li>)}</ul></section></StaffingPanel>}
  </section>;
}
