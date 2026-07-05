import type { AssignmentConflict, AssignmentProposal, AssignmentProposalResult, CleaningPlanningFilters, CleaningPlanningTask, EffectiveWorkerAvailability } from './cleaningPlanning';
import type { Cleaner } from './calendar';
import type { Sede } from './sede';

export type PlanningCopilotActionType =
  | 'assign_task'
  | 'unassign_task'
  | 'reassign_task'
  | 'assign_multiple_cleaners'
  | 'change_task_schedule'
  | 'create_incident'
  | 'send_notice'
  | 'add_internal_note'
  | 'suggest_building_group'
  | 'mark_manual_review';

export type PlanningCopilotActionStatus = 'draft' | 'ready' | 'blocked' | 'requires_confirmation' | 'applied' | 'rejected';

export interface PlanningCopilotAction {
  id: string;
  type: PlanningCopilotActionType;
  taskId?: string;
  propertyId?: string;
  cleanerIds?: string[];
  previousCleanerIds?: string[];
  proposedStartTime?: string;
  proposedEndTime?: string;
  proposedDate?: string;
  title: string;
  explanation: string;
  warnings: string[];
  blockers: string[];
  confidence: number;
  requiresConfirmation: true;
  status: PlanningCopilotActionStatus;
  metadata?: Record<string, unknown>;
}

export interface PlanningCopilotSnapshot {
  sede?: Pick<Sede, 'id' | 'nombre' | 'codigo' | 'ciudad'> | null;
  range: { startDate: string; endDate: string };
  filters: CleaningPlanningFilters;
  visibleTasks: CleaningPlanningTask[];
  visibleUnassignedTasks: CleaningPlanningTask[];
  visibleAssignedTasks: CleaningPlanningTask[];
  cleaners: Cleaner[];
  availability: EffectiveWorkerAvailability[];
  activeProposal?: AssignmentProposalResult | null;
  summary: {
    totalVisibleTasks: number;
    unassignedTasks: number;
    assignedTasks: number;
    earlyCheckInTasks: number;
    largeHouseTasks: number;
    conflictTasks: number;
    proposalAssignments: number;
    proposalConflicts: number;
  };
}

export interface PlanningCopilotMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  createdAt: string;
  actions?: PlanningCopilotAction[];
  proposal?: AssignmentProposalResult | null;
  conflicts?: AssignmentConflict[];
}

export interface PlanningCopilotReply {
  message: string;
  actions: PlanningCopilotAction[];
  shouldGenerateProposal?: boolean;
  shouldOpenConfirmation?: boolean;
}

export const proposalsToCopilotActions = (proposals: AssignmentProposal[]): PlanningCopilotAction[] => proposals.map((proposal) => ({
  id: `proposal:${proposal.taskId}:${proposal.cleanerId}:${proposal.assignmentIndex || 1}`,
  type: proposal.requiredCleaners && proposal.requiredCleaners > 1 ? 'assign_multiple_cleaners' : 'assign_task',
  taskId: proposal.taskId,
  cleanerIds: [proposal.cleanerId],
  title: `Asignar ${proposal.cleanerName}`,
  explanation: proposal.reasons.join(' '),
  warnings: proposal.warnings,
  blockers: [],
  confidence: proposal.confidence,
  requiresConfirmation: true,
  status: 'requires_confirmation',
  metadata: {
    propertyGroupId: proposal.propertyGroupId,
    propertyGroupName: proposal.propertyGroupName,
    requiredCleaners: proposal.requiredCleaners,
    assignmentIndex: proposal.assignmentIndex,
    durationMinutes: proposal.durationMinutes,
  },
}));
