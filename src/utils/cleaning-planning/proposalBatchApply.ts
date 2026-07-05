import type { Task } from '../../types/calendar';
import type { AssignmentProposal } from '../../types/cleaningPlanning';
import { isPlannableTaskStatus } from '../cleaningPlanning';

export type ProposalBatchReasonCode =
  | 'invalid_signature'
  | 'empty_batch'
  | 'duplicate_cleaner_for_task'
  | 'expected_task_missing'
  | 'task_not_found_in_active_sede'
  | 'sede_mismatch'
  | 'cleaner_not_in_sede'
  | 'invalid_status'
  | 'already_assigned'
  | 'stale_task';

export type ProposalBatchItemStatus = 'ready' | 'blocked';

export interface ProposalBatchValidationItem {
  taskId: string;
  cleanerIds: string[];
  cleanerNames: string[];
  status: ProposalBatchItemStatus;
  reasonCode?: ProposalBatchReasonCode;
  message: string;
}

export interface ProposalBatchTaskPlan {
  taskId: string;
  cleanerIds: string[];
  cleanerNames: string[];
  previousCleanerIds: string[];
}

export interface ProposalBatchValidationResult {
  canApply: boolean;
  items: ProposalBatchValidationItem[];
  taskPlans: ProposalBatchTaskPlan[];
  summary: {
    totalTasks: number;
    readyTasks: number;
    blockedTasks: number;
    totalAssignments: number;
  };
}

export interface ValidateProposalBatchForApplyInput {
  proposals: AssignmentProposal[];
  proposalSignature: string;
  activeSedeId?: string | null;
  activeCleanerIds: string[];
  expectedTasks: Task[];
  freshTasks: Task[];
}

type TaskWithSede = Task & { sedeId?: string | null; requiredCleaners?: number | null };

const unique = <T>(values: T[]): T[] => Array.from(new Set(values));

export const buildProposalSignature = (proposals: AssignmentProposal[]): string => proposals
  .map((proposal) => `${proposal.taskId}:${proposal.cleanerId}`)
  .sort()
  .join('|');

const groupProposalsByTask = (proposals: AssignmentProposal[]): ProposalBatchTaskPlan[] => {
  const byTask = new Map<string, ProposalBatchTaskPlan>();

  proposals.forEach((proposal) => {
    const existing = byTask.get(proposal.taskId) || {
      taskId: proposal.taskId,
      cleanerIds: [],
      cleanerNames: [],
      previousCleanerIds: [],
    };

    existing.cleanerIds.push(proposal.cleanerId);
    existing.cleanerNames.push(proposal.cleanerName);
    byTask.set(proposal.taskId, existing);
  });

  return Array.from(byTask.values()).map((plan) => ({
    ...plan,
    cleanerIds: unique(plan.cleanerIds),
    cleanerNames: unique(plan.cleanerNames),
  }));
};

const buildBlockedItem = (
  plan: ProposalBatchTaskPlan,
  reasonCode: ProposalBatchReasonCode,
  message: string,
): ProposalBatchValidationItem => ({
  taskId: plan.taskId,
  cleanerIds: plan.cleanerIds,
  cleanerNames: plan.cleanerNames,
  status: 'blocked',
  reasonCode,
  message,
});

const sameOperationalWindow = (expected: Task, fresh: Task): boolean => (
  expected.date === fresh.date
  && expected.startTime === fresh.startTime
  && expected.endTime === fresh.endTime
);

const getTaskSedeId = (task?: Task): string | null => (task as TaskWithSede | undefined)?.sedeId || null;

const getTaskCleanerIds = (task?: Task): string[] => {
  const assignmentIds = (task?.assignments || [])
    .map((assignment) => assignment.cleaner_id)
    .filter(Boolean);
  const ids = assignmentIds.length > 0 ? assignmentIds : ([task?.cleanerId].filter(Boolean) as string[]);
  return Array.from(new Set(ids));
};

const sameCleanerSet = (a: string[], b: string[]): boolean => {
  const left = Array.from(new Set(a)).sort();
  const right = Array.from(new Set(b)).sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
};

export const validateProposalBatchForApply = ({
  proposals,
  proposalSignature,
  activeSedeId,
  activeCleanerIds,
  expectedTasks,
  freshTasks,
}: ValidateProposalBatchForApplyInput): ProposalBatchValidationResult => {
  const activeCleanerSet = new Set(activeCleanerIds);
  const expectedById = new Map(expectedTasks.map((task) => [task.id, task]));
  const freshById = new Map(freshTasks.map((task) => [task.id, task]));
  const taskPlans = groupProposalsByTask(proposals);

  if (proposals.length === 0) {
    return {
      canApply: false,
      items: [],
      taskPlans: [],
      summary: { totalTasks: 0, readyTasks: 0, blockedTasks: 0, totalAssignments: 0 },
    };
  }

  if (buildProposalSignature(proposals) !== proposalSignature) {
    const items = taskPlans.map((plan) => buildBlockedItem(
      plan,
      'invalid_signature',
      'La propuesta cambió antes de aplicarse. Regenera la propuesta para evitar asignaciones obsoletas.',
    ));
    return {
      canApply: false,
      items,
      taskPlans: [],
      summary: {
        totalTasks: taskPlans.length,
        readyTasks: 0,
        blockedTasks: items.length,
        totalAssignments: proposals.length,
      },
    };
  }

  const items: ProposalBatchValidationItem[] = taskPlans.map((plan) => {
    if (plan.cleanerIds.length !== proposals.filter((proposal) => proposal.taskId === plan.taskId).length) {
      return buildBlockedItem(plan, 'duplicate_cleaner_for_task', 'La propuesta contiene la misma limpiadora repetida para una tarea.');
    }

    const inactiveCleanerId = plan.cleanerIds.find((cleanerId) => !activeCleanerSet.has(cleanerId));
    if (inactiveCleanerId) {
      return buildBlockedItem(plan, 'cleaner_not_in_sede', 'La propuesta incluye una limpiadora que no pertenece a la sede activa o ya no está disponible.');
    }

    const expectedTask = expectedById.get(plan.taskId);
    if (!expectedTask) {
      return buildBlockedItem(plan, 'expected_task_missing', 'No se conserva el contexto original de la tarea propuesta. Regenera la propuesta.');
    }

    const freshTask = freshById.get(plan.taskId);
    if (!freshTask) {
      return buildBlockedItem(plan, 'task_not_found_in_active_sede', 'La tarea ya no existe en la sede/rango activo.');
    }

    const expectedSedeId = getTaskSedeId(expectedTask);
    const freshSedeId = getTaskSedeId(freshTask);
    if (activeSedeId && ((expectedSedeId && expectedSedeId !== activeSedeId) || (freshSedeId && freshSedeId !== activeSedeId))) {
      return buildBlockedItem(plan, 'sede_mismatch', 'La tarea o la propuesta pertenecen a otra sede.');
    }

    if (!isPlannableTaskStatus(freshTask.status)) {
      return buildBlockedItem(plan, 'invalid_status', 'La tarea ya no está en estado planificable.');
    }

    const expectedCleanerIds = getTaskCleanerIds(expectedTask);
    const freshCleanerIds = getTaskCleanerIds(freshTask);
    if (freshCleanerIds.length > 0 && expectedCleanerIds.length === 0) {
      return buildBlockedItem(plan, 'already_assigned', 'La tarea ya tiene asignación fresca. Regenera la propuesta para no pisar trabajo manual.');
    }

    if (!sameCleanerSet(expectedCleanerIds, freshCleanerIds)) {
      return buildBlockedItem(plan, 'stale_task', 'La asignación actual de la tarea cambió desde que se generó la propuesta.');
    }

    if (sameCleanerSet(plan.cleanerIds, freshCleanerIds)) {
      return buildBlockedItem(plan, 'already_assigned', 'La propuesta no cambia la asignación actual de la tarea.');
    }

    if (!sameOperationalWindow(expectedTask, freshTask)) {
      return buildBlockedItem(plan, 'stale_task', 'La fecha u horario de la tarea cambió desde que se generó la propuesta.');
    }

    return {
      taskId: plan.taskId,
      cleanerIds: plan.cleanerIds,
      cleanerNames: plan.cleanerNames,
      status: 'ready',
      message: 'Lista para aplicar.',
    };
  });

  const readyItems = items.filter((item) => item.status === 'ready');
  const readyPlans = taskPlans
    .filter((plan) => readyItems.some((item) => item.taskId === plan.taskId))
    .map((plan) => {
      const freshTask = freshById.get(plan.taskId);
      return {
        ...plan,
        previousCleanerIds: getTaskCleanerIds(freshTask),
      };
    });

  const blockedTasks = items.length - readyItems.length;

  return {
    canApply: blockedTasks === 0 && readyPlans.length > 0,
    items,
    taskPlans: blockedTasks === 0 ? readyPlans : [],
    summary: {
      totalTasks: items.length,
      readyTasks: readyItems.length,
      blockedTasks,
      totalAssignments: proposals.length,
    },
  };
};
