import { useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
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

export function availableMinutesForPeriod(worker: StaffingWorker, days: StaffingDay[]): number {
  const weekDates = (date: string) => {
    const value = new Date(`${date}T12:00:00Z`);
    const monday = new Date(value.getTime() - ((value.getUTCDay() + 6) % 7) * 86400000);
    return Array.from({ length: 7 }, (_, offset) => new Date(monday.getTime() + offset * 86400000).toISOString().slice(0, 10));
  };
  const blockedForDate = (date: string) => {
    const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
    return (worker.blockedSlots || []).filter(block => block.date ? block.date === date : block.day === dayOfWeek);
  };
  const unionMinutes = (intervals: { startMinute: number; endMinute: number }[]) => intervals
    .filter(interval => interval.endMinute > interval.startMinute)
    .sort((a, b) => a.startMinute - b.startMinute)
    .reduce((total, interval, index, sorted) => {
      if (index === 0) return interval.endMinute - interval.startMinute;
      const previousEnd = Math.max(...sorted.slice(0, index).map(item => item.endMinute));
      return total + Math.max(0, interval.endMinute - Math.max(interval.startMinute, previousEnd));
    }, 0);
  const paidWeekMinutes = (date: string) => weekDates(date).reduce((total, weekDate) => total + unionMinutes(blockedForDate(weekDate).filter(block => block.consumesContract)), 0);
  const total = days.reduce((sum, day) => {
    if ((worker.activeFrom && day.date < worker.activeFrom) || (worker.activeTo && day.date > worker.activeTo) || worker.unavailableDates.includes(day.date) || worker.confirmedRestDates.includes(day.date)) return sum;
    const dayOfWeek = new Date(`${day.date}T12:00:00Z`).getUTCDay();
    if (worker.restDay === dayOfWeek && !worker.flexibleRest) return sum;
    const blocks = blockedForDate(day.date);
    const minutes = worker.availability.filter(slot => slot.day === dayOfWeek).reduce((slotTotal, slot) => {
      const blocked = unionMinutes(blocks.map(block => ({ startMinute: Math.max(slot.startMinute, block.startMinute), endMinute: Math.min(slot.endMinute, block.endMinute) })));
      return slotTotal + Math.max(0, slot.endMinute - slot.startMinute - blocked);
    }, 0);
    const paid = unionMinutes(blocks.filter(block => block.consumesContract));
    return sum + Math.min(Math.max(0, (worker.maxDailyMinutes ?? 1440) - paid), minutes);
  }, 0);
  const paidOutsidePeriod = days.length ? Math.max(...days.map(day => paidWeekMinutes(day.date))) : 0;
  return Math.min(Math.max(0, worker.weeklyMinutes - paidOutsidePeriod), total);
}

export function StaffingTeam({ workers, days, week, onSimulate }: Props) {
  const [search, setSearch] = useState('');
  const [engagement, setEngagement] = useState<'all' | 'employee' | 'collaborator'>('all');
  const [sort, setSort] = useState<'unassigned' | 'name'>('unassigned');
  const rows = useMemo<TeamRow[]>(() => workers.map(worker => {
    const assignedMinutes = days.flatMap(day => day.assignments).filter(assignment => assignment.workerId === worker.id).reduce((total, assignment) => total + assignment.personMinutes, 0);
    const availableMinutes = availableMinutesForPeriod(worker, days);
    return { worker, assignedMinutes, availableMinutes, unassignedMinutes: Math.max(0, availableMinutes - assignedMinutes) };
  }).filter(row => (row.worker.engagement || 'employee') === engagement || engagement === 'all')
    .filter(row => row.worker.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
    .sort((a, b) => sort === 'name' ? a.worker.name.localeCompare(b.worker.name, 'es') : b.unassignedMinutes - a.unassignedMinutes || a.worker.name.localeCompare(b.worker.name, 'es')),
  [workers, days, engagement, search, sort]);
  const employees = rows.filter(row => (row.worker.engagement || 'employee') === 'employee');

  const table = (title: string, group: TeamRow[]) => <section aria-label={title} className="min-w-0">
    <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#eeeaf4] pb-3"><h3 className="text-base font-bold text-[#201936]">{title}</h3><span className="text-xs text-[#817a8c]">{group.length} {group.length === 1 ? 'persona' : 'personas'}</span></header>
    {group.length === 0 ? <p className="py-6 text-sm text-[#716a7d]">No hay personas que coincidan con el filtro.</p> : <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><caption className="sr-only">{title} · semana {week || 'seleccionada'}</caption><thead className="text-xs text-[#817a8c]"><tr><th className="py-2 pr-3">Persona</th><th className="px-3 py-2 text-right">Puede trabajar</th><th className="px-3 py-2 text-right">Limpiezas asignadas</th><th className="px-3 py-2 text-right">Horas libres</th><th className="px-3 py-2">Aviso</th></tr></thead><tbody>{group.map(row => {
      const progress = row.availableMinutes ? Math.min(100, row.assignedMinutes / row.availableMinutes * 100) : 0;
      // Un cero sin motivo parece un fallo de la aplicación: aquí se dice por qué.
      const reason = !Number.isFinite(row.worker.weeklyMinutes) || row.worker.weeklyMinutes === 0
        ? 'Sin horas en su ficha'
        : row.availableMinutes === 0
          ? `Sin días disponibles · ficha ${hours(row.worker.weeklyMinutes)}`
          : '';
      return <tr key={row.worker.id} className="border-t border-[#f0edf5] align-middle"><th className="py-3 pr-3 font-medium text-[#201936]"><div className="flex items-center gap-2"><span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eee9f7] text-xs font-bold text-[#390b92]">{initials(row.worker.name)}</span><span className="min-w-0"><span className="block break-words">{row.worker.name}</span><span className="block text-xs font-normal text-[#817a8c]">Plantilla</span></span></div></th><td className="px-3 py-3 text-right tabular-nums text-[#4f485b]">{hours(row.availableMinutes)}</td><td className="px-3 py-3 text-right tabular-nums text-[#4f485b]"><span className="flex items-center justify-end gap-2"><span aria-hidden="true" className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-[#eeeaf4] sm:block"><span className="block h-full bg-[#390b92]" style={{ width: `${progress}%` }} /></span>{hours(row.assignedMinutes)}</span></td><td className={`px-3 py-3 text-right font-semibold tabular-nums ${row.unassignedMinutes > 0 ? 'text-[#a46c00]' : 'text-[#716a7d]'}`}>{hours(row.unassignedMinutes)}</td><td className="px-3 py-3 text-xs text-[#716a7d]">{reason || '—'}</td></tr>;
    })}</tbody></table></div>}
  </section>;

  return <section aria-label="Equipo de previsión" className={`${panelClass} space-y-5`}>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#390b92]">Equipo</p><h2 className="mt-1 text-xl font-bold tracking-tight text-[#201936]">Equipo y carga simulada</h2><p className="mt-1 text-sm text-[#716a7d]">Semana {week || 'seleccionada'} · calculado con la disponibilidad registrada, no con el cuadrante real.</p></div><button type="button" className="inline-flex min-h-9 items-center gap-1 text-xs font-bold text-[#390b92]" onClick={onSimulate}>Editar escenario <ArrowRight className="h-3.5 w-3.5" /></button></header>
    <div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-xs font-medium">Buscar persona<span className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#a19aab]" /><input aria-label="Buscar persona en equipo" type="search" className={`${fieldClass} pl-9`} placeholder="Nombre" value={search} onChange={event => setSearch(event.target.value)} /></span></label><label className="grid gap-1 text-xs font-medium">Vinculación<select aria-label="Filtrar vinculación" className={fieldClass} value={engagement} onChange={event => setEngagement(event.target.value as typeof engagement)}><option value="all">Todas</option><option value="employee">Plantilla</option></select></label><label className="grid gap-1 text-xs font-medium">Ordenar por<select aria-label="Ordenar equipo" className={fieldClass} value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="unassigned">Horas libres</option><option value="name">Nombre</option></select></label></div>
    <p className="rounded-lg border border-[#eee5c9] bg-[#fffaf0] p-3 text-xs leading-5 text-[#80621b]">Las horas libres dependen del reparto simulado y de los datos disponibles. No significan automáticamente exceso de jornada ni necesidad de reducir personal.</p>
    {engagement === 'all' || engagement === 'employee' ? table('Plantilla', employees) : null}
  </section>;
}
