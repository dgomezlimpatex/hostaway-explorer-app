import { useMemo, useState } from 'react';
import type { StaffingDay, StaffingWorker } from './types';
import { fieldClass, hours, panelClass } from './presentation';

interface Props {
  workers: StaffingWorker[];
  days: StaffingDay[];
  week?: string;
  onSimulate: () => void;
}

interface TeamRow {
  worker: StaffingWorker;
  assignedMinutes: number;
  availableMinutes: number;
  unassignedMinutes: number;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('');
}

export function StaffingTeam({ workers, days, week, onSimulate }: Props) {
  const [search, setSearch] = useState('');
  const [engagement, setEngagement] = useState<'all' | 'employee' | 'collaborator'>('all');
  const [sort, setSort] = useState<'unassigned' | 'name'>('unassigned');
  const rows = useMemo<TeamRow[]>(() => workers.map(worker => {
    const assignedMinutes = days.flatMap(day => day.assignments).filter(assignment => assignment.workerId === worker.id).reduce((total, assignment) => total + assignment.personMinutes, 0);
    const availableMinutes = Math.max(0, worker.weeklyMinutes);
    return { worker, assignedMinutes, availableMinutes, unassignedMinutes: Math.max(0, availableMinutes - assignedMinutes) };
  }).filter(row => (row.worker.engagement || 'employee') === engagement || engagement === 'all')
    .filter(row => row.worker.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
    .sort((a, b) => sort === 'name' ? a.worker.name.localeCompare(b.worker.name, 'es') : b.unassignedMinutes - a.unassignedMinutes || a.worker.name.localeCompare(b.worker.name, 'es')),
  [workers, days, engagement, search, sort]);
  const employees = rows.filter(row => (row.worker.engagement || 'employee') === 'employee');
  const collaborators = rows.filter(row => row.worker.engagement === 'collaborator');

  const table = (title: string, group: TeamRow[]) => <section aria-label={title} className="min-w-0">
    <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-200 pb-3"><h3 className="text-base font-semibold">{title}</h3><span className="text-xs text-stone-500">{group.length} {group.length === 1 ? 'persona' : 'personas'}</span></header>
    {group.length === 0 ? <p className="py-6 text-sm text-stone-600">No hay personas que coincidan con el filtro.</p> : <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><caption className="sr-only">{title} · semana {week || 'seleccionada'}</caption><thead className="text-xs text-stone-500"><tr><th className="py-2 pr-3">Persona</th><th className="px-3 py-2 text-right">Presupuesto semanal</th><th className="px-3 py-2 text-right">Trabajo simulado</th><th className="px-3 py-2 text-right">Presupuesto sin asignar</th><th className="px-3 py-2">Centro habitual</th></tr></thead><tbody>{group.map(row => {
      const progress = row.availableMinutes ? Math.min(100, row.assignedMinutes / row.availableMinutes * 100) : 0;
      return <tr key={row.worker.id} className="border-t border-stone-100 align-middle"><th className="py-3 pr-3 font-medium"><div className="flex items-center gap-2"><span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eee9f7] text-xs font-bold text-[#310984]">{initials(row.worker.name)}</span><span className="min-w-0"><span className="block break-words">{row.worker.name}</span><span className="block text-xs font-normal text-stone-500">{row.worker.engagement === 'collaborator' ? 'Colaborador habitual' : 'Plantilla'}</span></span></div></th><td className="px-3 py-3 text-right tabular-nums">{hours(row.availableMinutes)}</td><td className="px-3 py-3 text-right tabular-nums"><span className="flex items-center justify-end gap-2"><span aria-hidden="true" className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-stone-100 sm:block"><span className="block h-full bg-[#310984]" style={{ width: `${progress}%` }} /></span>{hours(row.assignedMinutes)}</span></td><td className={`px-3 py-3 text-right font-semibold tabular-nums ${row.unassignedMinutes > 0 ? 'text-amber-800' : 'text-stone-600'}`}>{hours(row.unassignedMinutes)}</td><td className="max-w-[220px] px-3 py-3 text-xs text-stone-600">{row.worker.homeCenterIds.length ? `${row.worker.homeCenterIds.length} centro${row.worker.homeCenterIds.length === 1 ? '' : 's'}` : 'Sin centro habitual'}</td></tr>;
    })}</tbody></table></div>}
  </section>;

  return <section aria-label="Equipo de previsión" className={`${panelClass} space-y-5`}>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#310984]">Equipo</p><h2 className="mt-1 text-xl font-semibold">Distribución del trabajo</h2><p className="mt-1 text-sm text-stone-600">Semana {week || 'seleccionada'} · horas simuladas, no cuadrante real.</p></div><button type="button" className={`${fieldClass} !border-[#310984] !bg-[#310984] !text-white`} onClick={onSimulate}>Editar escenario</button></header>
    <div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-xs font-medium">Buscar persona<input aria-label="Buscar persona en equipo" type="search" className={fieldClass} placeholder="Nombre" value={search} onChange={event => setSearch(event.target.value)} /></label><label className="grid gap-1 text-xs font-medium">Vinculación<select aria-label="Filtrar vinculación" className={fieldClass} value={engagement} onChange={event => setEngagement(event.target.value as typeof engagement)}><option value="all">Todas</option><option value="employee">Plantilla</option><option value="collaborator">Colaboradores</option></select></label><label className="grid gap-1 text-xs font-medium">Ordenar por<select aria-label="Ordenar equipo" className={fieldClass} value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="unassigned">Horas sin asignar</option><option value="name">Nombre</option></select></label></div>
    <p className="rounded-md border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">«Presupuesto sin asignar» es tiempo del contrato de plantilla o del presupuesto operativo del colaborador que no aparece en la simulación. No significa que pueda cubrir automáticamente un servicio: también cuentan día, horario, centro y movilidad.</p>
    {engagement === 'all' || engagement === 'employee' ? table('Plantilla', employees) : null}
    {engagement === 'all' || engagement === 'collaborator' ? table('Colaboradores habituales', collaborators) : null}
  </section>;
}
