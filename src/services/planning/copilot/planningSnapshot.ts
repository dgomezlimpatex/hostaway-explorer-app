import type { AssignmentProposalResult, CleaningPlanningFilters, CleaningPlanningTask, EffectiveWorkerAvailability } from '@/types/cleaningPlanning';
import type { Cleaner } from '@/types/calendar';
import type { Sede } from '@/types/sede';
import type { PlanningCopilotSnapshot } from '@/types/planningCopilot';

const timeToMinutes = (time?: string | null): number | null => {
  if (!time) return null;
  const [hoursRaw, minutesRaw = '0'] = time.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const isEarlyCheckIn = (task: CleaningPlanningTask): boolean => {
  const checkInMinutes = timeToMinutes(task.checkIn);
  return checkInMinutes !== null && checkInMinutes <= 14 * 60;
};

const isLargeHouse = (task: CleaningPlanningTask): boolean => task.durationMinutes > 6 * 60;

export interface BuildPlanningCopilotSnapshotInput {
  activeSede?: Sede | null;
  range: { startDate: string; endDate: string };
  filters: CleaningPlanningFilters;
  visibleTasks: CleaningPlanningTask[];
  cleaners: Cleaner[];
  availability: EffectiveWorkerAvailability[];
  activeProposal?: AssignmentProposalResult | null;
}

export const buildPlanningCopilotSnapshot = ({
  activeSede,
  range,
  filters,
  visibleTasks,
  cleaners,
  availability,
  activeProposal = null,
}: BuildPlanningCopilotSnapshotInput): PlanningCopilotSnapshot => {
  const visibleUnassignedTasks = visibleTasks.filter((task) => !task.cleanerId);
  const visibleAssignedTasks = visibleTasks.filter((task) => Boolean(task.cleanerId));

  return {
    sede: activeSede ? {
      id: activeSede.id,
      nombre: activeSede.nombre,
      codigo: activeSede.codigo,
      ciudad: activeSede.ciudad,
    } : null,
    range,
    filters,
    visibleTasks,
    visibleUnassignedTasks,
    visibleAssignedTasks,
    cleaners,
    availability,
    activeProposal,
    summary: {
      totalVisibleTasks: visibleTasks.length,
      unassignedTasks: visibleUnassignedTasks.length,
      assignedTasks: visibleAssignedTasks.length,
      earlyCheckInTasks: visibleTasks.filter(isEarlyCheckIn).length,
      largeHouseTasks: visibleTasks.filter(isLargeHouse).length,
      conflictTasks: visibleTasks.filter((task) => task.riskFlags.length > 0).length,
      proposalAssignments: activeProposal?.proposals.length || 0,
      proposalConflicts: activeProposal?.conflicts.length || 0,
    },
  };
};

export const describePlanningScope = (snapshot: PlanningCopilotSnapshot): string => {
  const hasFilters = snapshot.filters.taskFilter !== 'all'
    || snapshot.filters.zone !== 'all'
    || snapshot.filters.cleanerId !== 'all'
    || snapshot.filters.search.trim().length > 0;
  const sedeLabel = snapshot.sede?.nombre || 'sede activa';
  return `${sedeLabel} · ${snapshot.range.startDate}${snapshot.range.endDate !== snapshot.range.startDate ? ` → ${snapshot.range.endDate}` : ''} · ${hasFilters ? 'búsqueda/filtros aplicados' : 'vista completa'} · ${snapshot.summary.totalVisibleTasks} limpiezas`;
};
