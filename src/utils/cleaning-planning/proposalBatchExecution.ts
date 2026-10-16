import type { ProposalBatchTaskPlan } from './proposalBatchApply';

interface ProposalBatchExecutionDependencies<TResult> {
  updateSchedule: (taskId: string, startTime: string, endTime: string) => Promise<unknown>;
  setAssignments: (taskId: string, cleanerIds: string[]) => Promise<TResult>;
  // Deshacer un lote fallido no debe generar avisos: por defecto usa setAssignments.
  revertAssignments?: (taskId: string, cleanerIds: string[]) => Promise<unknown>;
}

interface AppliedPlanState {
  plan: ProposalBatchTaskPlan;
  scheduleAttempted: boolean;
  assignmentAttempted: boolean;
}

export interface ProposalBatchExecutionResult<TResult> {
  taskId: string;
  result: TResult;
}

const requireSchedule = (
  plan: ProposalBatchTaskPlan,
  startTime: string | undefined,
  endTime: string | undefined,
  label: string,
): [string, string] => {
  if (!startTime || !endTime) {
    throw new Error(`La tarea ${plan.taskId} no tiene un horario ${label} completo.`);
  }
  return [startTime, endTime];
};

const toClock = (time: string | undefined): string | undefined => {
  if (!time) return undefined;
  return /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
};

// Solo se omite la escritura cuando la base ya tiene exactamente ese horario.
const scheduleUnchanged = (plan: ProposalBatchTaskPlan, startTime: string, endTime: string): boolean => (
  toClock(plan.previousStartTime) === toClock(startTime) && toClock(plan.previousEndTime) === toClock(endTime)
);

export interface ProposalBatchExecutionOptions {
  // Tareas guardadas a la vez. Por defecto 1: una detrás de otra, como siempre.
  concurrency?: number;
}

export const executeProposalBatch = async <TResult>(
  plans: ProposalBatchTaskPlan[],
  dependencies: ProposalBatchExecutionDependencies<TResult>,
  options: ProposalBatchExecutionOptions = {},
): Promise<Array<ProposalBatchExecutionResult<TResult>>> => {
  const appliedStates: AppliedPlanState[] = [];
  const results: Array<ProposalBatchExecutionResult<TResult>> = new Array(plans.length);
  const concurrency = Math.max(1, Math.min(Math.floor(options.concurrency ?? 1) || 1, plans.length || 1));
  let nextIndex = 0;
  let failure: { error: unknown } | null = null;

  const applyPlan = async (plan: ProposalBatchTaskPlan, index: number) => {
    const [proposedStartTime, proposedEndTime] = requireSchedule(
      plan,
      plan.proposedStartTime,
      plan.proposedEndTime,
      'propuesto',
    );
    requireSchedule(plan, plan.previousStartTime, plan.previousEndTime, 'anterior');

    const state: AppliedPlanState = {
      plan,
      scheduleAttempted: false,
      assignmentAttempted: false,
    };
    appliedStates.push(state);

    if (!scheduleUnchanged(plan, proposedStartTime, proposedEndTime)) {
      state.scheduleAttempted = true;
      await dependencies.updateSchedule(plan.taskId, proposedStartTime, proposedEndTime);
    }

    state.assignmentAttempted = true;
    const result = await dependencies.setAssignments(plan.taskId, plan.cleanerIds);
    results[index] = { taskId: plan.taskId, result };
  };

  // Tras el primer fallo no se empieza ninguna tarea nueva, pero se espera a que
  // terminen las que ya estaban en marcha para poder deshacerlas todas.
  const worker = async () => {
    while (!failure) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= plans.length) return;
      try {
        await applyPlan(plans[index], index);
      } catch (error) {
        failure ??= { error };
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  if (!failure) return results;

  for (const state of appliedStates.slice().reverse()) {
    const { plan } = state;
    if (state.assignmentAttempted) {
      try {
        await (dependencies.revertAssignments ?? dependencies.setAssignments)(plan.taskId, plan.previousCleanerIds);
      } catch {
        // Continue reverting the remaining batch state.
      }
    }

    if (state.scheduleAttempted && plan.previousStartTime && plan.previousEndTime) {
      try {
        await dependencies.updateSchedule(plan.taskId, plan.previousStartTime, plan.previousEndTime);
      } catch {
        // Preserve the original apply failure after best-effort rollback.
      }
    }
  }
  throw (failure as { error: unknown }).error;
};
