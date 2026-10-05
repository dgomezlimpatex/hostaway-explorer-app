import { recordAiObservedEvent } from '@/services/aiObservedEvents';
import type { AssignmentProposal } from '@/types/cleaningPlanning';
import type { ProposalBatchValidationResult } from '@/utils/cleaning-planning/proposalBatchApply';

export interface RecordPlanningCopilotApplyInput {
  activeSedeId?: string | null;
  proposals: AssignmentProposal[];
  validation: ProposalBatchValidationResult;
  scope?: Record<string, unknown>;
}

export const recordPlanningCopilotApply = ({
  activeSedeId,
  proposals,
  validation,
  scope = {},
}: RecordPlanningCopilotApplyInput): void => {
  void recordAiObservedEvent({
    eventType: 'planning_copilot_proposal_applied',
    entityType: 'planning_proposal',
    sedeId: activeSedeId || null,
    source: 'hermes-planning-copilot',
    summary: `Reparto aplicado desde el planificador diario: ${validation.summary.readyTasks} limpiezas / ${validation.summary.totalAssignments} asignaciones tras confirmacion humana.`,
    beforeData: {
      scope,
      proposalCount: proposals.length,
    },
    afterData: {
      validationSummary: validation.summary,
      taskPlans: validation.taskPlans.map((plan) => ({
        taskId: plan.taskId,
        cleanerCount: plan.cleanerIds.length,
        previousCleanerCount: plan.previousCleanerIds.length,
      })),
    },
    metadata: {
      requiresHumanConfirmation: true,
      notifications: 'sent_immediately_after_confirmation',
    },
  });
};
