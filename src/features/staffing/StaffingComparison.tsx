import { ArrowRight, Check, CircleHelp } from 'lucide-react';
import type { StaffingDay, StaffingWeek } from './types';
import { hours, knownUncovered, money, panelClass, shortDate } from './presentation';

interface Props {
  baseline?: StaffingWeek;
  current?: StaffingWeek;
  changed: boolean;
  uncertain: boolean;
  days: StaffingDay[];
  onOpenScenario: () => void;
}

export function StaffingComparison({ baseline, current, changed, uncertain, days, onOpenScenario }: Props) {
  const baseUncovered = baseline ? knownUncovered(baseline) : 0;
  const currentUncovered = current ? knownUncovered(current) : 0;
  const improvement = Math.max(0, baseUncovered - currentUncovered);
  const affectedDays = days.filter(day => knownUncovered(day) > 0).length;
  const assignedMinutes = days.reduce((total, day) => total + day.assignments.reduce((dayTotal, assignment) => dayTotal + assignment.personMinutes, 0), 0);
  return <section className={`${panelClass} overflow-hidden`} aria-label="Comparación de escenarios">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#390b92]">Decisión</p><h2 className="mt-1 text-xl font-bold tracking-tight text-[#201936]">Comparación de escenarios</h2><p className="mt-1 text-sm text-[#716a7d]">Base frente a la simulación actual · sin guardar cambios.</p></div><button type="button" onClick={onOpenScenario} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#390b92] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#2d0676]">{changed ? 'Editar simulación' : 'Probar escenario'} <ArrowRight className="h-4 w-4" /></button></header>
    {!baseline || !current ? <p className="mt-5 rounded-lg bg-[#faf9fc] p-4 text-sm text-[#716a7d]">Selecciona una semana con datos para comparar alternativas.</p> : <div className="mt-5 grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-[#ece8f3] bg-[#fcfbfe] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#817a8c]">Carga conocida</p><p className="mt-2 text-lg font-bold tabular-nums text-[#201936]">{hours(baseline.knownMinutes)} <span className="text-sm font-normal text-[#aaa3b3]">→</span> {hours(current.knownMinutes)}</p><p className="mt-1 text-xs text-[#716a7d]">Horas-persona registradas</p></div>
      <div className="rounded-lg border border-[#ece8f3] bg-[#fcfbfe] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#817a8c]">Capacidad potencial</p><p className="mt-2 text-lg font-bold tabular-nums text-[#201936]">{hours(baseline.capacityMinutes)} <span className="text-sm font-normal text-[#aaa3b3]">→</span> {hours(current.capacityMinutes)}</p><p className="mt-1 text-xs text-[#716a7d]">No equivale a cobertura libre</p></div>
      <div className="rounded-lg border border-[#d8eee9] bg-[#f7fcfb] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#19766d]">Horas sin encajar</p><p className="mt-2 text-lg font-bold tabular-nums text-[#19766d]">{hours(baseUncovered)} <span className="text-sm font-normal text-[#aaa3b3]">→</span> {hours(currentUncovered)}</p><p className="mt-1 text-xs text-[#557d78]">{changed ? `${hours(improvement)} reducidas con la simulación` : 'Carga conocida; no incluye estimaciones'}</p></div>
    </div>}
    <div className="mt-4 grid gap-2 border-t border-[#eeeaf4] pt-4 text-xs text-[#716a7d] sm:grid-cols-3"><span><strong className="block text-[#201936]">{affectedDays || '—'}</strong>Días afectados por servicios sin encajar</span><span><strong className="block text-[#201936]">{hours(assignedMinutes)}</strong>Trabajo asignado en la simulación</span><span><strong className="block text-[#201936]">{baseline && current && baseline.cost !== null && current.cost !== null ? `${money(baseline.cost)} → ${money(current.cost)}` : 'No disponible'}</strong>Coste solo con datos suficientes</span></div>
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#eeeaf4] pt-3 text-xs text-[#817a8c]"><span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#19766d]" />{baseline ? `Semana desde ${shortDate(baseline.week)}` : 'Sin semana seleccionada'}</span><span className="inline-flex items-center gap-1.5"><CircleHelp className="h-3.5 w-3.5" />{uncertain ? 'Resultado parcial: revisa fuentes y criterios.' : 'Resultado calculado con las fuentes disponibles.'}</span></div>
  </section>;
}
