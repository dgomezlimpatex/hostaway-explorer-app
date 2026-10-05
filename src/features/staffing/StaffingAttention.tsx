import { AlertTriangle, ArrowRight, CalendarClock, CircleAlert, FileWarning, UsersRound } from 'lucide-react';
import type { StaffingDay, StaffingWeek, StaffingWorker } from './types';
import type { StaffingMonth } from './monthly';
import { hours, shortDate, panelClass } from './presentation';
import { availableMinutesForPeriod } from './StaffingTeam';

interface Props {
  weeks: StaffingWeek[];
  months: StaffingMonth[];
  workers: StaffingWorker[];
  onWeek: (week: string) => void;
  onTeam: () => void;
  onScenario: () => void;
  uncertain?: boolean;
  /** Alcance del resumen: por defecto «Total del periodo» (todo el horizonte). */
  periodLabel?: string;
  periodSubtitle?: string;
  /** Totales del periodo elegido, sumados por días civiles del mes/semana/horizonte. */
  totals?: { knownMinutes: number; estimatedMinutes: number; capacityMinutes: number };
  /** Jornada de ficha del periodo: lo que el equipo DEBE trabajar y se paga. */
  committedMinutes?: number;
  /** Tope del periodo: jornada comprometida + 30 % como máximo. */
  maxMinutes?: number;
  /** Semana más cargada del periodo, ya recortada a los días del periodo. */
  peak?: { week: string; minutes: number };
  /** Tramos del periodo con más trabajo que equipo. Si falta, se deduce de las semanas completas. */
  overloadedPeriod?: { week: string; knownMinutes: number; capacityMinutes: number }[];
  /** Días del periodo para contar personas con jornada sin repartir. */
  unassignedDays?: StaffingDay[];
  unassignedScope?: string;
}

export function StaffingAttention({ weeks, months, workers, onWeek, onTeam, onScenario, uncertain = false, periodLabel, periodSubtitle, totals, committedMinutes, maxMinutes, peak, overloadedPeriod, unassignedDays = [], unassignedScope }: Props) {
  const overloaded = overloadedPeriod ?? weeks.filter(week => week.knownMinutes > week.capacityMinutes).map(week => ({ week: week.week, knownMinutes: week.knownMinutes, capacityMinutes: week.capacityMinutes }));
  const unassignedWorkers = unassignedDays.length ? workers.map(worker => {
    const assignedMinutes = unassignedDays.flatMap(day => day.assignments).filter(assignment => assignment.workerId === worker.id).reduce((total, assignment) => total + assignment.personMinutes, 0);
    return { worker, minutes: Math.max(0, availableMinutesForPeriod(worker, unassignedDays) - assignedMinutes) };
  }).filter(row => row.minutes > 0) : [];
  const incomplete = months.filter(month => month.status === 'future' && month.estimatedMinutes === 0);
  // Total del periodo: es lo primero que necesita saber quien planifica. Se suman días civiles, no semanas solapadas.
  const totalKnown = totals ? totals.knownMinutes : weeks.reduce((total, week) => total + week.knownMinutes, 0);
  const totalEstimated = totals ? totals.estimatedMinutes : weeks.reduce((total, week) => total + week.estimatedMinutes, 0);
  const totalWork = totalKnown + totalEstimated;
  const totalCapacity = totals ? totals.capacityMinutes : weeks.reduce((total, week) => total + week.capacityMinutes, 0);
  // La jornada de ficha es el mínimo que hay que cubrir; el 30 % adicional es el techo, no la referencia.
  const committed = committedMinutes ?? totalCapacity;
  const ceiling = Math.max(committed, maxMinutes ?? totalCapacity);
  const unassignedJornada = Math.max(0, committed - totalWork);
  const beyondJornada = Math.max(0, totalWork - committed);
  const beyondCeiling = Math.max(0, totalWork - ceiling);
  const busiestWeek = weeks.length > 1 ? [...weeks].sort((a, b) => (b.knownMinutes + b.estimatedMinutes) - (a.knownMinutes + a.estimatedMinutes) || a.week.localeCompare(b.week))[0] : undefined;
  const busiestMonth = months.length > 1 ? [...months].sort((a, b) => (b.knownMinutes + b.estimatedMinutes) - (a.knownMinutes + a.estimatedMinutes) || a.month.localeCompare(b.month))[0] : undefined;
  const verdict = !totalWork || !committed
    ? 'Todavía no hay datos suficientes para decir si el equipo llega.'
    : beyondJornada === 0
      ? `Con el trabajo ya registrado, la jornada de ficha del equipo cubre el periodo: ${hours(totalWork)} de trabajo frente a ${hours(committed)} de jornada comprometida; quedan ${hours(unassignedJornada)} de jornada pagada sin trabajo asignado.`
      : beyondCeiling > 0
        ? `El equipo no llega ni con un 30 % más: ${hours(totalWork)} de trabajo frente a ${hours(ceiling)} como máximo; faltan ${hours(beyondCeiling)}.`
        : `La jornada de ficha no llega: ${hours(totalWork)} de trabajo frente a ${hours(committed)} de jornada comprometida. Cabe usando hasta un 30 % más (${hours(ceiling)} como máximo).`;
  const peakText = peak
    ? `Lo más cargado es la semana del ${shortDate(peak.week)} (${hours(peak.minutes)})`
    : busiestWeek
      ? `Lo más cargado es la semana del ${shortDate(busiestWeek.week)} (${hours(busiestWeek.knownMinutes + busiestWeek.estimatedMinutes)})`
      : '';
  const focus = peakText ? ` ${peakText}${busiestMonth ? `, y el mes con más trabajo es ${busiestMonth.label}` : ''}.` : '';
  const cards = [
    overloaded.length ? { key: 'overload', tone: 'amber', icon: AlertTriangle, value: `${overloaded.length} ${overloaded.length === 1 ? 'semana' : 'semanas'}`, title: `Semanas con más trabajo que equipo${uncertain ? ' · datos incompletos' : ''}`, detail: `Trabajo ya registrado entre el ${shortDate(overloaded[0].week)} y el ${shortDate(overloaded[overloaded.length - 1].week)}${uncertain ? ' · confirma las fuentes antes de decidir' : ''}`, action: 'Ver semanas', onClick: () => onWeek(overloaded[0].week) } : null,
    unassignedWorkers.length ? { key: 'unassigned', tone: 'rose', icon: UsersRound, value: `${unassignedWorkers.length} ${unassignedWorkers.length === 1 ? 'persona' : 'personas'}`, title: 'Jornada sin repartir', detail: `${hours(unassignedWorkers.reduce((total, row) => total + row.minutes, 0))} de jornada pagada sin limpieza asignada ${unassignedScope || 'en el periodo elegido'}`, action: 'Revisar equipo', onClick: onTeam } : null,
    incomplete.length ? { key: 'incomplete', tone: 'violet', icon: FileWarning, value: incomplete.map(month => month.label).join(' y '), title: 'Meses sin estimación', detail: 'Mira solo lo ya reservado: aún no hay reservas nuevas estimadas para estos meses.', action: 'Definir escenario', onClick: onScenario } : null,
  ].filter(Boolean) as { key: string; tone: string; icon: typeof AlertTriangle; value: string; title: string; detail: string; action: string; onClick: () => void }[];
  const totalsCards = [
    { label: 'Trabajo ya registrado', value: hours(totalKnown), note: totalEstimated > 0 ? `+ ${hours(totalEstimated)} estimado` : 'Sin estimaciones adicionales' },
    { label: 'Jornada comprometida', value: hours(committed), note: `Horas de ficha que hay que cubrir · hasta ${hours(ceiling)} con un 30 % más` },
    beyondJornada === 0
      ? { label: 'Jornada sin trabajo asignado', value: hours(unassignedJornada), note: 'Se paga igual: falta trabajo registrado para esa jornada' }
      : beyondCeiling > 0
        ? { label: 'Lo que falta', value: hours(beyondCeiling), note: `Ni con un 30 % más de jornada (máximo ${hours(ceiling)}) llega el equipo` }
        : { label: 'Falta sobre la jornada de ficha', value: hours(beyondJornada), note: 'Cabe usando el margen de hasta un 30 % más de jornada' },
  ];
  return <section aria-label="Qué necesita atención" className="space-y-4"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#390b92]">Resumen ejecutivo</p><h2 className="mt-1 text-xl font-bold tracking-tight text-[#201936]">Qué necesita atención</h2></div><span className="inline-flex items-center gap-1.5 text-xs text-[#817a8c]"><CalendarClock className="h-3.5 w-3.5" />{uncertain ? 'Faltan datos · revisa las fuentes' : 'Datos leídos correctamente'}</span></header>
    <article className={`${panelClass} space-y-4`} aria-label={periodLabel || 'Total del periodo'}>
      <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#390b92]">{periodLabel || 'Total del periodo'}</p><p className="text-xs text-[#817a8c]">{periodSubtitle || `${weeks.length} semanas · ${months.length} meses`}</p></div>
      <p className="text-base font-bold leading-6 text-[#201936] sm:text-lg">{verdict}{focus}</p>
      <dl className="grid gap-3 sm:grid-cols-3">{totalsCards.map(item => <div key={item.label} className="rounded-lg border border-[#eeeaf4] bg-[#faf9fc] p-3"><dt className="text-xs font-medium text-[#817a8c]">{item.label}</dt><dd className="mt-1 text-xl font-bold tabular-nums text-[#201936]">{item.value}</dd><dd className="mt-1 text-xs leading-4 text-[#716a7d]">{item.note}</dd></div>)}</dl>
    </article>
    {cards.length ? <div className="grid gap-3 lg:grid-cols-3">{cards.map(card => { const Icon = card.icon; return <article key={card.key} className={`${panelClass} relative overflow-hidden !p-4`}><div className={`absolute inset-x-0 top-0 h-1 ${card.tone === 'amber' ? 'bg-[#e7a922]' : card.tone === 'rose' ? 'bg-[#d34f70]' : 'bg-[#7650bb]'}`} /><div className="flex items-start justify-between gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.tone === 'amber' ? 'bg-[#fff4d9] text-[#a46c00]' : card.tone === 'rose' ? 'bg-[#fff0f3] text-[#ba385c]' : 'bg-[#f0ebfa] text-[#6841a9]'}`}><Icon className="h-4.5 w-4.5" /></span><span className="text-2xl font-bold tabular-nums text-[#201936]">{card.value}</span></div><h3 className="mt-4 font-bold text-[#201936]">{card.title}</h3><p className="mt-1 min-h-10 text-sm leading-5 text-[#716a7d]">{card.detail}</p><button type="button" className="mt-3 inline-flex min-h-9 items-center gap-1 text-xs font-bold text-[#390b92]" onClick={card.onClick}>{card.action}<ArrowRight className="h-3.5 w-3.5" /></button></article>; })}</div> : <div className={`${panelClass} flex items-start gap-3 text-sm text-[#716a7d]`}><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#390b92]" />No hay incidencias calculadas en este periodo. Si faltan fuentes, revisa criterios antes de concluir que todo está cubierto.</div>}</section>;
}
