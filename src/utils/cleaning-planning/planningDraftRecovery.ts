import type { Cleaner, Task } from '../../types/calendar';
import type { AssignmentProposal, EffectiveWorkerAvailability } from '../../types/cleaningPlanning';
import type { CleanerGroupAssignment } from '../../types/propertyGroups';
import { isPlannableTaskStatus } from '../cleaningPlanning';
import { availabilityContextValue } from './proposalContext';
import {
  hydrateProposal,
  sanitizeProposal,
  type DraftBaseline,
  type DraftTaskBaseline,
  type PlanningDraftRecord,
} from './planningDraftStore';

type PlanningTaskLike = Task & {
  requiredCleaners?: number | null;
  detectedBuilding?: { propertyGroupId?: string } | null;
};

export const draftAvailabilityKey = (cleanerId: string, date: string): string => `${cleanerId}|${date}`;

const cleanerIdsOf = (task: Task): string[] => {
  const ids = (task.assignments || []).map((assignment) => assignment.cleaner_id).filter(Boolean);
  return Array.from(new Set(ids.length > 0 ? ids : ([task.cleanerId].filter(Boolean) as string[]))).sort();
};

/** Datos de la tarea que importan para saber si el borrador sigue siendo válido. */
export const taskBaselineOf = (task: Task): DraftTaskBaseline => {
  const candidate = task as PlanningTaskLike;
  const baseline: DraftTaskBaseline = {
    label: String(candidate.propertyCode || candidate.property || '').slice(0, 40),
    date: candidate.date,
    startTime: candidate.startTime,
    endTime: candidate.endTime,
    status: candidate.status || '',
    cleanerIds: cleanerIdsOf(candidate),
    requiredCleaners: Math.max(1, candidate.requiredCleaners || 1),
  };
  const building = candidate.detectedBuilding?.propertyGroupId;
  if (building) baseline.building = building;
  return baseline;
};

const sameOperationalFacts = (left: DraftTaskBaseline, right: DraftTaskBaseline): boolean => (
  left.date === right.date
  && left.startTime === right.startTime
  && left.endTime === right.endTime
  && left.status === right.status
  && left.requiredCleaners === right.requiredCleaners
  && left.cleanerIds.join('|') === right.cleanerIds.join('|')
);

/**
 * Línea base del borrador: cómo estaban las tareas implicadas y la disponibilidad de cada
 * trabajadora y día cuando se construyó. Se calcula con los datos vigentes mientras el reparto
 * no esté desfasado; si lo está, el panel conserva la línea base anterior.
 */
export const buildDraftBaseline = ({ proposals, tasks, availability }: {
  proposals: AssignmentProposal[];
  tasks: Task[];
  availability: EffectiveWorkerAvailability[];
}): DraftBaseline => {
  const taskById: Record<string, Task> = {};
  tasks.forEach((task) => { taskById[task.id] = task; });
  const availabilityByKey: Record<string, EffectiveWorkerAvailability> = {};
  availability.forEach((item) => { availabilityByKey[draftAvailabilityKey(item.cleanerId, item.date)] = item; });
  const baseline: DraftBaseline = { tasks: {}, availability: {} };
  proposals.forEach((proposal) => {
    const task = taskById[proposal.taskId];
    if (!task) return;
    baseline.tasks[task.id] = taskBaselineOf(task);
    if (proposal.operation === 'unassign') return;
    const key = draftAvailabilityKey(proposal.cleanerId, task.date);
    const item = availabilityByKey[key];
    if (item) baseline.availability[key] = availabilityContextValue(item);
  });
  return baseline;
};

export type DraftConflictCode =
  | 'no_baseline'
  | 'task_missing'
  | 'task_not_plannable'
  | 'task_changed'
  | 'building_changed'
  | 'outside_scope'
  | 'cleaner_unavailable'
  | 'cleaner_excluded'
  | 'availability_changed';

export interface DraftConflict {
  taskId: string;
  label: string;
  codes: DraftConflictCode[];
  reasons: string[];
}

export interface DraftEvaluation {
  status: 'ready' | 'partial' | 'blocked';
  /** Propuestas de las tareas que se pueden recuperar con seguridad (tarea completa o ninguna). */
  recoverable: AssignmentProposal[];
  editedTaskIds: string[];
  recoveredTaskCount: number;
  totalTaskCount: number;
  conflicts: DraftConflict[];
}

const statusLabel = (status: string): string => {
  if (status === 'completed') return 'completada';
  if (status === 'cancelled' || status === 'canceled') return 'cancelada';
  return `en estado «${status || 'desconocido'}»`;
};

const timeRange = (baseline: DraftTaskBaseline): string => `${baseline.startTime}–${baseline.endTime}`;

const describeTaskChange = (before: DraftTaskBaseline, now: DraftTaskBaseline): string[] => {
  const reasons: string[] = [];
  if (before.date !== now.date) reasons.push('ha cambiado de día');
  if (before.startTime !== now.startTime || before.endTime !== now.endTime) reasons.push(`ha cambiado el horario (${timeRange(before)} → ${timeRange(now)})`);
  if (before.cleanerIds.join('|') !== now.cleanerIds.join('|')) reasons.push('ha cambiado quién la tiene asignada');
  if (before.requiredCleaners !== now.requiredCleaners) reasons.push('ha cambiado el número de personas necesarias');
  return reasons.length ? reasons : ['ha cambiado desde que se guardó el borrador'];
};

export interface DraftEvaluationInput {
  record: PlanningDraftRecord;
  /** Tareas leídas ahora mismo de la base de datos (sin filtros). */
  freshTasks: Task[];
  /** Tareas que muestra la pantalla actual (con edificio detectado y filtros aplicados). */
  scopeTasks: Task[];
  cleaners: Cleaner[];
  availability: EffectiveWorkerAvailability[];
  excludedCleanerAssignments: CleanerGroupAssignment[];
}

/**
 * Decide qué parte del borrador puede recuperarse sin pisar cambios de otras personas. El criterio
 * es la tarea: se recupera completa o no se recupera, y un cambio ajeno a las tareas del borrador
 * no lo invalida. Nunca escribe nada: solo compara el borrador con el estado actual.
 */
export const evaluateDraftRecovery = ({ record, freshTasks, scopeTasks, cleaners, availability, excludedCleanerAssignments }: DraftEvaluationInput): DraftEvaluation => {
  const freshById: Record<string, Task> = {};
  freshTasks.forEach((task) => { freshById[task.id] = task; });
  const scopeById: Record<string, Task> = {};
  scopeTasks.forEach((task) => { scopeById[task.id] = task; });
  const cleanerById: Record<string, Cleaner> = {};
  cleaners.forEach((cleaner) => { cleanerById[cleaner.id] = cleaner; });
  const availabilityByKey: Record<string, EffectiveWorkerAvailability> = {};
  availability.forEach((item) => { availabilityByKey[draftAvailabilityKey(item.cleanerId, item.date)] = item; });

  const taskIds = Array.from(new Set(record.proposals.map((proposal) => proposal.taskId)));
  const conflicts: DraftConflict[] = [];
  const blockedTaskIds = new Set<string>();

  taskIds.forEach((taskId) => {
    const baseline = record.baseline.tasks[taskId];
    const label = baseline?.label || 'Limpieza';
    const codes: DraftConflictCode[] = [];
    const reasons: string[] = [];
    const add = (code: DraftConflictCode, reason: string) => { codes.push(code); reasons.push(reason); };

    const fresh = freshById[taskId];
    if (!baseline) {
      add('no_baseline', 'no hay datos para comprobar esta limpieza');
    } else if (!fresh) {
      add('task_missing', 'la limpieza ya no existe, se ha cancelado o se ha movido de día');
    } else if (!isPlannableTaskStatus(fresh.status)) {
      add('task_not_plannable', `ya está ${statusLabel(fresh.status)}`);
    } else {
      const now = taskBaselineOf(fresh);
      if (!sameOperationalFacts(baseline, now)) describeTaskChange(baseline, now).forEach((reason) => add('task_changed', reason));
      const scoped = scopeById[taskId] as PlanningTaskLike | undefined;
      if (!scoped) add('outside_scope', 'no aparece con los filtros o el periodo actuales');
      else if ((baseline.building || undefined) !== (scoped.detectedBuilding?.propertyGroupId || undefined)) add('building_changed', 'ha cambiado el edificio de la limpieza');
    }

    if (baseline && fresh && codes.length === 0) {
      record.proposals.filter((proposal) => proposal.taskId === taskId && proposal.operation !== 'unassign').forEach((proposal) => {
        const cleaner = cleanerById[proposal.cleanerId];
        if (!cleaner || !cleaner.isActive) {
          if (!codes.includes('cleaner_unavailable')) add('cleaner_unavailable', 'una de las trabajadoras ya no está activa en esta sede');
          return;
        }
        const buildingId = baseline.building;
        if (buildingId && excludedCleanerAssignments.some((assignment) => (
          assignment.propertyGroupId === buildingId && assignment.cleanerId === proposal.cleanerId && assignment.roleType === 'excluded'
        ))) add('cleaner_excluded', `${cleaner.name} está marcada como no apta para este edificio`);
        const key = draftAvailabilityKey(proposal.cleanerId, baseline.date);
        const before = record.baseline.availability[key];
        const current = availabilityByKey[key];
        if (before !== undefined && (!current || availabilityContextValue(current) !== before)) {
          add('availability_changed', `ha cambiado la disponibilidad de ${cleaner.name} ese día`);
        }
      });
    }

    if (codes.length) {
      blockedTaskIds.add(taskId);
      conflicts.push({ taskId, label, codes, reasons });
    }
  });

  const recoverable = record.proposals
    .filter((proposal) => !blockedTaskIds.has(proposal.taskId))
    .map((proposal) => hydrateProposal(proposal, (cleanerId) => cleanerById[cleanerId]?.name));
  const recoveredTaskCount = taskIds.length - blockedTaskIds.size;
  return {
    status: recoveredTaskCount === 0 && taskIds.length > 0 ? 'blocked' : conflicts.length ? 'partial' : 'ready',
    recoverable,
    editedTaskIds: record.editedTaskIds.filter((taskId) => taskIds.includes(taskId) && !blockedTaskIds.has(taskId)),
    recoveredTaskCount,
    totalTaskCount: taskIds.length,
    conflicts,
  };
};

/**
 * ¿Coinciden la lectura nueva y lo que ya muestra la pantalla para estas tareas? La pantalla solo
 * muestra tareas planificables, así que una tarea cancelada o completada en la lectura nueva
 * «coincide» cuando la pantalla ya no la muestra.
 */
export const taskStatesAgree = (freshTasks: Task[], shownTasks: Task[], taskIds: string[]): boolean => {
  const fresh: Record<string, Task> = {};
  freshTasks.forEach((task) => { fresh[task.id] = task; });
  const shown: Record<string, Task> = {};
  shownTasks.forEach((task) => { shown[task.id] = task; });
  return taskIds.every((taskId) => {
    const left = fresh[taskId];
    const right = shown[taskId];
    if (!left && !right) return true;
    if (!left || !right) return !right && !isPlannableTaskStatus(left?.status);
    return sameOperationalFacts(taskBaselineOf(left), taskBaselineOf(right));
  });
};

export const contentFromDraft = (proposals: AssignmentProposal[], editedTaskIds: string[], baseline: DraftBaseline) => ({
  proposals: proposals.map(sanitizeProposal),
  editedTaskIds: Array.from(new Set(editedTaskIds)).filter((taskId) => proposals.some((proposal) => proposal.taskId === taskId)),
  baseline,
});
