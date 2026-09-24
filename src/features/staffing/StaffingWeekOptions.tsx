import { ArrowRight, GitBranch, UsersRound } from 'lucide-react';
import type { StaffingDay, StaffingWeek } from './types';
import { hours, knownUncovered, panelClass, shortDate } from './presentation';

interface Props {
  week?: StaffingWeek;
  days: StaffingDay[];
  onScenario: () => void;
}

/** Acciones de la maqueta: abren una simulación, nunca escriben el cuadrante real. */
export function StaffingWeekOptions({ week, days, onScenario }: Props) {
  const knownUncoveredMinutes = week ? knownUncovered(week) : 0;
  const knownUnassignedServices = days.reduce((total, day) => total + knownUncovered(day), 0);
  return <aside className="space-y-3 rounded-xl border border-[#e3deed] border-t-4 border-t-[#e7a922] bg-white p-4 shadow-[0_8px_24px_rgba(57,11,146,0.06)] sm:p-5" aria-label="Opciones para esta semana">
    <div><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#390b92]">Siguiente paso</p><h2 className="mt-1 text-xl font-bold tracking-tight text-[#201936]">Opciones para esta semana</h2><p className="mt-1 text-sm text-[#716a7d]">Compara el efecto antes de decidir.</p></div>
    <button type="button" onClick={onScenario} className={`${panelClass} group w-full text-left transition hover:-translate-y-0.5 hover:border-[#b7a3d7]`}>
      <span className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0ebfa] text-[#390b92]"><GitBranch className="h-5 w-5" /></span><ArrowRight className="h-4 w-4 text-[#a19aab] transition group-hover:translate-x-1 group-hover:text-[#390b92]" /></span>
      <strong className="mt-4 block text-base text-[#201936]">Reforzar el fin de semana</strong>
      <span className="mt-1 block text-sm leading-5 text-[#716a7d]">{knownUncoveredMinutes > 0 ? `Simula un refuerzo para cubrir ${hours(knownUncoveredMinutes)} de trabajo sin repartir.` : 'Explora el efecto de un refuerzo hipotético sobre la distribución.'}</span>
      <span className="mt-3 block text-xs font-bold text-[#390b92]">Probar refuerzo <span aria-hidden="true">→</span></span>
    </button>
    <button type="button" onClick={onScenario} className={`${panelClass} group w-full text-left transition hover:-translate-y-0.5 hover:border-[#b7a3d7]`}>
      <span className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf8f6] text-[#19766d]"><UsersRound className="h-5 w-5" /></span><ArrowRight className="h-4 w-4 text-[#a19aab] transition group-hover:translate-x-1 group-hover:text-[#19766d]" /></span>
      <strong className="mt-4 block text-base text-[#201936]">Redistribuir trabajo</strong>
      <span className="mt-1 block text-sm leading-5 text-[#716a7d]">Revisa equipo y disponibilidad para los {days.length} días seleccionados.</span>
      <span className="mt-3 block text-xs font-bold text-[#19766d]">Probar distribución <span aria-hidden="true">→</span></span>
    </button>
    <p className="border-t border-[#eeeaf4] px-1 pt-3 text-xs leading-5 text-[#817a8c]">{week ? `Semana desde ${shortDate(week.week)} · ${hours(knownUnassignedServices)} de trabajo conocido sin repartir.` : 'Selecciona una semana para habilitar opciones.'}<br />Las estimaciones adicionales quedan pendientes de comprobar. Los cambios solo afectan a la simulación.</p>
  </aside>;
}
