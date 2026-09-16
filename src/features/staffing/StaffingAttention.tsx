import type { StaffingDay, StaffingWeek, StaffingWorker } from './types';
import type { StaffingMonth } from './monthly';
import { fieldClass, hours, panelClass, shortDate } from './presentation';

interface Props {
  weeks: StaffingWeek[];
  months: StaffingMonth[];
  selectedWeek?: string;
  selectedDays: StaffingDay[];
  workers: StaffingWorker[];
  onWeek: (week: string) => void;
  onTeam: () => void;
  onScenario: () => void;
}

export function StaffingAttention({ weeks, months, selectedWeek, selectedDays, workers, onWeek, onTeam, onScenario }: Props) {
  const overloaded = weeks.filter(week => week.knownMinutes > week.capacityMinutes).sort((a, b) => a.week.localeCompare(b.week));
  const unassignedDays = selectedDays.filter(day => day.knownMinutes > 0 && day.uncoveredMinutes > day.estimatedMinutes);
  const unassignedWorkers = selectedWeek && selectedDays.length > 0 ? workers.map(worker => {
    const assignedMinutes = selectedDays.flatMap(day => day.assignments).filter(assignment => assignment.workerId === worker.id).reduce((total, assignment) => total + assignment.personMinutes, 0);
    return { worker, minutes: Math.max(0, worker.weeklyMinutes - assignedMinutes) };
  }).filter(row => row.minutes > 0) : [];
  const incomplete = months.filter(month => month.status === 'future' && month.estimatedMinutes === 0);
  const cards = [
    overloaded.length ? { key: 'overload', tone: 'amber', value: `${overloaded.length} ${overloaded.length === 1 ? 'semana' : 'semanas'}`, title: 'Carga conocida por encima de la capacidad', detail: `${shortDate(overloaded[0].week)}–${shortDate(overloaded[overloaded.length - 1].week)}`, action: 'Ver semanas', onClick: () => onWeek(overloaded[0].week) } : null,
    unassignedDays.length ? { key: 'uncovered', tone: 'rose', value: `${unassignedDays.length} ${unassignedDays.length === 1 ? 'día' : 'días'}`, title: 'Servicios sin encajar', detail: `${hours(unassignedDays.reduce((total, day) => total + Math.max(0, day.uncoveredMinutes - day.estimatedMinutes), 0))} en la semana seleccionada`, action: 'Ver detalle', onClick: () => onWeek(selectedWeek || selectedDays[0]?.date || '') } : null,
    unassignedWorkers.length ? { key: 'unassigned', tone: 'amber', value: `${unassignedWorkers.length} ${unassignedWorkers.length === 1 ? 'persona' : 'personas'}`, title: 'Horas sin asignar en la simulación', detail: `${hours(unassignedWorkers.reduce((total, row) => total + row.minutes, 0))} en la semana seleccionada · presupuesto no asignado (no equivale a cobertura libre)`, action: 'Revisar equipo', onClick: onTeam } : null,
    incomplete.length ? { key: 'incomplete', tone: 'violet', value: incomplete.map(month => month.label).join(' y '), title: 'Sin hipótesis adicional configurada', detail: 'La fuente no aporta una hipótesis adicional; no equivale a baja demanda.', action: 'Definir escenario', onClick: onScenario } : null,
  ].filter(Boolean) as { key: string; tone: string; value: string; title: string; detail: string; action: string; onClick: () => void }[];

  return <section aria-label="Qué necesita atención" className="space-y-3"><header className="flex flex-wrap items-baseline justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#310984]">Diagnóstico</p><h2 className="mt-1 text-xl font-semibold">Qué necesita atención</h2></div>{cards.length === 0 && <span className="text-sm text-stone-600">No hay incidencias calculadas en este periodo.</span>}</header>{cards.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{cards.map(card => <article key={card.key} className={`${panelClass} border-t-4 ${card.tone === 'amber' ? 'border-t-amber-500' : card.tone === 'rose' ? 'border-t-rose-600' : 'border-t-[#6938c6]'}`}><p className="text-2xl font-semibold tabular-nums">{card.value}</p><h3 className="mt-1 font-semibold">{card.title}</h3><p className="mt-1 text-sm text-stone-600">{card.detail}</p><button type="button" className={`${fieldClass} mt-4 !min-h-10 !border-transparent !px-0 !py-1 !text-[#310984] !underline`} onClick={card.onClick}>{card.action} →</button></article>)}</div> : <div className={`${panelClass} py-5 text-sm text-stone-600`}>La lectura no ha detectado semanas por encima de la capacidad ni días con servicios sin encajar. Si faltan fuentes, revisa el panel de criterios antes de concluir que todo está cubierto.</div>}</section>;
}
