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
  /** Alcance del resumen: por defecto «Total del periodo» (todo el horizonte). */
  periodLabel?: string;
  periodSubtitle?: string;
}

export function StaffingAttention({ weeks, months, selectedWeek, selectedDays, workers, onWeek, onTeam, onScenario, uncertain = false, periodLabel, periodSubtitle }: Props) {
  const overloaded = weeks.filter(week => week.knownMinutes > week.capacityMinutes).sort((a, b) => a.week.localeCompare(b.week));
  const unassignedWorkers = selectedWeek && selectedDays.length > 0 ? workers.map(worker => {
    const assignedMinutes = selectedDays.flatMap(day => day.assignments).filter(assignment => assignment.workerId === worker.id).reduce((total, assignment) => total + assignment.personMinutes, 0);
    return { worker, minutes: Math.max(0, availableMinutesForPeriod(worker, selectedDays) - assignedMinutes) };
  }).filter(row => row.minutes > 0) : [];
  const incomplete = months.filter(month => month.status === 'future' && month.estimatedMinutes === 0);
  // Total del periodo: es lo primero que necesita saber quien planifica.
  const totalKnown = weeks.reduce((total, week) => total + week.knownMinutes, 0);
  const totalEstimated = weeks.reduce((total, week) => total + week.estimatedMinutes, 0);
  const totalWork = totalKnown + totalEstimated;
  const totalCapacity = weeks.reduce((total, week) => total + week.capacityMinutes, 0);
  const slack = totalCapacity - totalWork;
  const busiestWeek = weeks.length ? [...weeks].sort((a, b) => (b.knownMinutes + b.estimatedMinutes) - (a.knownMinutes + a.estimatedMinutes) || a.week.localeCompare(b.week))[0] : undefined;
  const busiestMonth = months.length ? [...months].sort((a, b) => (b.knownMinutes + b.estimatedMinutes) - (a.knownMinutes + a.estimatedMinutes) || a.month.localeCompare(b.month))[0] : undefined;
  const verdict = !weeks.length || totalWork === 0 || totalCapacity === 0
    ? 'Todavía no hay datos suficientes para decir si el equipo llega.'
    : slack >= 0
      ? `Con el trabajo ya registrado, tu equipo llega: ${hours(totalWork)} de trabajo frente a ${hours(totalCapacity)} de equipo, te sobran ${hours(slack)}.`
      : `Con el trabajo ya registrado, tu equipo no llega: ${hours(totalWork)} de trabajo frente a ${hours(totalCapacity)} de equipo, te faltan ${hours(-slack)}.`;
  const focus = busiestWeek && weeks.length > 1
    ? ` Lo más cargado es la semana del ${shortDate(busiestWeek.week)} (${hours(busiestWeek.knownMinutes + busiestWeek.estimatedMinutes)})${busiestMonth && months.length > 1 ? `, y el mes con más trabajo es ${busiestMonth.label}` : ''}.`
    : '';
  const cards = [
    overloaded.length ? { key: 'overload', tone: 'amber', icon: AlertTriangle, value: `${overloaded.length} ${overloaded.length === 1 ? 'semana' : 'semanas'}`, title: `Semanas con más trabajo que equipo${uncertain ? ' · datos incompletos' : ''}`, detail: `Trabajo ya registrado entre el ${shortDate(overloaded[0].week)} y el ${shortDate(overloaded[overloaded.length - 1].week)}${uncertain ? ' · confirma las fuentes antes de decidir' : ''}`, action: 'Ver semanas', onClick: () => onWeek(overloaded[0].week) } : null,
    unassignedWorkers.length ? { key: 'unassigned', tone: 'rose', icon: UsersRound, value: `${unassignedWorkers.length} ${unassignedWorkers.length === 1 ? 'persona' : 'personas'}`, title: 'Horas libres del equipo', detail: `${hours(unassignedWorkers.reduce((total, row) => total + row.minutes, 0))} sin repartir en la semana elegida`, action: 'Revisar equipo', onClick: onTeam } : null,
    incomplete.length ? { key: 'incomplete', tone: 'violet', icon: FileWarning, value: incomplete.map(month => month.label).join(' y '), title: 'Meses sin estimación', detail: 'Mira solo lo ya reservado: aún no hay reservas nuevas estimadas para estos meses.', action: 'Definir escenario', onClick: onScenario } : null,
  ].filter(Boolean) as { key: string; tone: string; icon: typeof AlertTriangle; value: string; title: string; detail: string; action: string; onClick: () => void }[];
  const totals = [
    { label: 'Trabajo ya registrado', value: hours(totalKnown), note: totalEstimated > 0 ? `+ ${hours(totalEstimated)} estimado` : 'Sin estimaciones adicionales' },
    { label: 'Horas que puede hacer tu equipo', value: hours(totalCapacity), note: 'Horas de ficha del equipo actual' },
    { label: slack >= 0 ? 'Holgura' : 'Lo que falta', value: hours(Math.abs(slack)), note: slack >= 0 ? 'Te sobran estas horas en el periodo' : 'Trabajo sin equipo suficiente con los datos actuales' },
  ];
  return <section aria-label="Qué necesita atención" className="space-y-4"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#390b92]">Resumen ejecutivo</p><h2 className="mt-1 text-xl font-bold tracking-tight text-[#201936]">Qué necesita atención</h2></div><span className="inline-flex items-center gap-1.5 text-xs text-[#817a8c]"><CalendarClock className="h-3.5 w-3.5" />{uncertain ? 'Faltan datos · revisa las fuentes' : 'Datos leídos correctamente'}</span></header>
    <article className={`${panelClass} space-y-4`} aria-label={periodLabel || 'Total del periodo'}>
      <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#390b92]">{periodLabel || 'Total del periodo'}</p><p className="text-xs text-[#817a8c]">{periodSubtitle || `${weeks.length} semanas · ${months.length} meses`}</p></div>
      <p className="text-base font-bold leading-6 text-[#201936] sm:text-lg">{verdict}{focus}</p>
      <dl className="grid gap-3 sm:grid-cols-3">{totals.map(item => <div key={item.label} className="rounded-lg border border-[#eeeaf4] bg-[#faf9fc] p-3"><dt className="text-xs font-medium text-[#817a8c]">{item.label}</dt><dd className="mt-1 text-xl font-bold tabular-nums text-[#201936]">{item.value}</dd><dd className="mt-1 text-xs leading-4 text-[#716a7d]">{item.note}</dd></div>)}</dl>
    </article>
    {cards.length ? <div className="grid gap-3 lg:grid-cols-3">{cards.map(card => { const Icon = card.icon; return <article key={card.key} className={`${panelClass} relative overflow-hidden !p-4`}><div className={`absolute inset-x-0 top-0 h-1 ${card.tone === 'amber' ? 'bg-[#e7a922]' : card.tone === 'rose' ? 'bg-[#d34f70]' : 'bg-[#7650bb]'}`} /><div className="flex items-start justify-between gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.tone === 'amber' ? 'bg-[#fff4d9] text-[#a46c00]' : card.tone === 'rose' ? 'bg-[#fff0f3] text-[#ba385c]' : 'bg-[#f0ebfa] text-[#6841a9]'}`}><Icon className="h-4.5 w-4.5" /></span><span className="text-2xl font-bold tabular-nums text-[#201936]">{card.value}</span></div><h3 className="mt-4 font-bold text-[#201936]">{card.title}</h3><p className="mt-1 min-h-10 text-sm leading-5 text-[#716a7d]">{card.detail}</p><button type="button" className="mt-3 inline-flex min-h-9 items-center gap-1 text-xs font-bold text-[#390b92]" onClick={card.onClick}>{card.action}<ArrowRight className="h-3.5 w-3.5" /></button></article>; })}</div> : <div className={`${panelClass} flex items-start gap-3 text-sm text-[#716a7d]`}><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#390b92]" />No hay incidencias calculadas en este periodo. Si faltan fuentes, revisa criterios antes de concluir que todo está cubierto.</div>}</section>;
}
