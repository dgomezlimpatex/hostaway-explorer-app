import { AlertTriangle, ArrowRight, CalendarClock, CircleAlert, FileWarning, UsersRound } from 'lucide-react';
import type { StaffingDay, StaffingWeek, StaffingWorker } from './types';
import type { StaffingMonth } from './monthly';
import { hours, shortDate, panelClass } from './presentation';
import { availableMinutesForPeriod } from './StaffingTeam';

interface Props {
  weeks: StaffingWeek[];
  months: StaffingMonth[];
  selectedWeek?: string;
  selectedDays: StaffingDay[];
  workers: StaffingWorker[];
  onWeek: (week: string) => void;
  onTeam: () => void;
  onScenario: () => void;
  uncertain?: boolean;
}

export function StaffingAttention({ weeks, months, selectedWeek, selectedDays, workers, onWeek, onTeam, onScenario, uncertain = false }: Props) {
  const overloaded = weeks.filter(week => week.knownMinutes > week.capacityMinutes).sort((a, b) => a.week.localeCompare(b.week));
  const unassignedWorkers = selectedWeek && selectedDays.length > 0 ? workers.map(worker => {
    const assignedMinutes = selectedDays.flatMap(day => day.assignments).filter(assignment => assignment.workerId === worker.id).reduce((total, assignment) => total + assignment.personMinutes, 0);
    return { worker, minutes: Math.max(0, availableMinutesForPeriod(worker, selectedDays) - assignedMinutes) };
  }).filter(row => row.minutes > 0) : [];
  const incomplete = months.filter(month => month.status === 'future' && month.estimatedMinutes === 0);
  const cards = [
    overloaded.length ? { key: 'overload', tone: 'amber', icon: AlertTriangle, value: `${overloaded.length} ${overloaded.length === 1 ? 'semana' : 'semanas'}`, title: `Carga por encima de la capacidad${uncertain ? ' · parcial' : ''}`, detail: `Trabajo registrado · ${shortDate(overloaded[0].week)} – ${shortDate(overloaded[overloaded.length - 1].week)}${uncertain ? ' · revisa las fuentes antes de decidir' : ''}`, action: 'Ver semanas', onClick: () => onWeek(overloaded[0].week) } : null,
    unassignedWorkers.length ? { key: 'unassigned', tone: 'rose', icon: UsersRound, value: `${unassignedWorkers.length} ${unassignedWorkers.length === 1 ? 'persona' : 'personas'}`, title: 'Horas sin asignar en la simulación', detail: `${hours(unassignedWorkers.reduce((total, row) => total + row.minutes, 0))} en la semana seleccionada`, action: 'Revisar equipo', onClick: onTeam } : null,
    incomplete.length ? { key: 'incomplete', tone: 'violet', icon: FileWarning, value: incomplete.map(month => month.label).join(' y '), title: 'Previsión por completar', detail: 'Falta estimar nuevas reservas.', action: 'Definir escenario', onClick: onScenario } : null,
  ].filter(Boolean) as { key: string; tone: string; icon: typeof AlertTriangle; value: string; title: string; detail: string; action: string; onClick: () => void }[];
  return <section aria-label="Qué necesita atención" className="space-y-4"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#390b92]">Resumen ejecutivo</p><h2 className="mt-1 text-xl font-bold tracking-tight text-[#201936]">Qué necesita atención</h2></div><span className="inline-flex items-center gap-1.5 text-xs text-[#817a8c]"><CalendarClock className="h-3.5 w-3.5" />{uncertain ? 'Resultado parcial · revisa fuentes y criterios' : 'Lectura calculada con datos disponibles'}</span></header>{cards.length ? <div className="grid gap-3 lg:grid-cols-3">{cards.map(card => { const Icon = card.icon; return <article key={card.key} className={`${panelClass} relative overflow-hidden !p-4`}><div className={`absolute inset-x-0 top-0 h-1 ${card.tone === 'amber' ? 'bg-[#e7a922]' : card.tone === 'rose' ? 'bg-[#d34f70]' : 'bg-[#7650bb]'}`} /><div className="flex items-start justify-between gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.tone === 'amber' ? 'bg-[#fff4d9] text-[#a46c00]' : card.tone === 'rose' ? 'bg-[#fff0f3] text-[#ba385c]' : 'bg-[#f0ebfa] text-[#6841a9]'}`}><Icon className="h-4.5 w-4.5" /></span><span className="text-2xl font-bold tabular-nums text-[#201936]">{card.value}</span></div><h3 className="mt-4 font-bold text-[#201936]">{card.title}</h3><p className="mt-1 min-h-10 text-sm leading-5 text-[#716a7d]">{card.detail}</p><button type="button" className="mt-3 inline-flex min-h-9 items-center gap-1 text-xs font-bold text-[#390b92]" onClick={card.onClick}>{card.action}<ArrowRight className="h-3.5 w-3.5" /></button></article>; })}</div> : <div className={`${panelClass} flex items-start gap-3 text-sm text-[#716a7d]`}><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#390b92]" />No hay incidencias calculadas en este periodo. Si faltan fuentes, revisa criterios antes de concluir que todo está cubierto.</div>}</section>;
}
