import type { ProposalBatchTaskPlan } from './proposalBatchApply';

interface ProposalBatchExecutionDependencies<TResult> {
  updateSchedule: (taskId: string, startTime: string, endTime: string) => Promise<unknown>;
  setAssignments: (taskId: string, cleanerIds: string[]) => Promise<TResult>;
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

export const executeProposalBatch = async <TResult>(
  plans: ProposalBatchTaskPlan[],
  dependencies: ProposalBatchExecutionDependencies<TResult>,
): Promise<Array<ProposalBatchExecutionResult<TResult>>> => {
  const appliedStates: AppliedPlanState[] = [];
  const results: Array<ProposalBatchExecutionResult<TResult>> = [];

  try {
    for (const plan of plans) {
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

      state.scheduleAttempted = true;
      await dependencies.updateSchedule(plan.taskId, proposedStartTime, proposedEndTime);

      state.assignmentAttempted = true;
      const result = await dependencies.setAssignments(plan.taskId, plan.cleanerIds);
      results.push({ taskId: plan.taskId, result });
    }

    return results;
  } catch (error) {
    for (const state of appliedStates.slice().reverse()) {
      const { plan } = state;
      if (state.assignmentAttempted) {
        try {
          await dependencies.setAssignments(plan.taskId, plan.previousCleanerIds);
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
    throw error;
  }
};
