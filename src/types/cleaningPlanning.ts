import { Cleaner, Task } from './calendar';

export type PlanningTaskRisk =
  | 'unassigned'
  | 'overlap'
  | 'overcapacity'
  | 'missing-time'
  | 'missing-building'
  | 'ambiguous-building'
  | 'missing-duration'
  | 'no-real-availability'
  | 'no-preferred-worker'
  | 'proposal-conflict';

export type PlanningRangePreset = 'today' | '7d' | '30d';

export type BuildingDetectionStatus = 'detected' | 'not_detected' | 'ambiguous';

export type BuildingDetectionMatchType = 'prefix' | 'contains' | 'exact' | 'regex';

export interface BuildingDetectionRule {
  id: string;
  propertyGroupId: string;
  propertyGroupName: string;
  matchType: BuildingDetectionMatchType;
  pattern: string;
  priority: number;
  isActive: boolean;
}

export interface DetectedBuilding {
  status: BuildingDetectionStatus;
  propertyGroupId?: string;
  propertyGroupName?: string;
  matchedRuleId?: string;
  matchedPattern?: string;
  reason: string;
}

export type WorkerAvailabilitySource =
  | 'daily'
  | 'weekly'
  | 'absence'
  | 'fixed_day_off'
  | 'maintenance'
  | 'contract_fallback'
  | 'none';

export interface AvailabilityWindow {
  startTime: string;
  endTime: string;
}

export interface BlockedAvailabilityWindow {
  startTime?: string;
  endTime?: string;
  reason: string;
}

export interface EffectiveWorkerAvailability {
  cleanerId: string;
  date: string;
  isAvailable: boolean;
  source: WorkerAvailabilitySource;
  availableWindows: AvailabilityWindow[];
  blockedWindows: BlockedAvailabilityWindow[];
  availableMinutes: number;
  assignedMinutes: number;
  remainingMinutes: number;
  notes?: string;
}

export type AssignmentConflictCode =
  | 'building_not_detected'
  | 'building_ambiguous'
  | 'missing_duration'
  | 'no_available_worker'
  | 'no_building_team'
  | 'over_capacity'
  | 'worker_absent'
  | 'invalid_time_window'
  | 'availability_window_mismatch'
  | 'blocked_by_maintenance'
  | 'blocked_by_partial_absence'
  | 'max_tasks_per_day'
  | 'time_overlap'
  | 'time_buffer_overlap';

export type PlanningAssignmentRole = 'primary' | 'secondary' | 'backup';

export interface AssignmentProposal {
  taskId: string;
  cleanerId: string;
  cleanerName: string;
  propertyGroupId?: string;
  propertyGroupName?: string;
  bundleId?: string;
  assignmentRole?: PlanningAssignmentRole;
  durationMinutes: number;
  proposedStartTime?: string;
  proposedEndTime?: string;
  requiredCleaners?: number;
  assignmentIndex?: number;
  confidence: number;
  reasons: string[];
  warnings: string[];
  capacityAfterAssignment: {
    assignedMinutes: number;
    remainingMinutes: number;
  };
}

export interface AssignmentConflict {
  taskId: string;
  code: AssignmentConflictCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface GlobalPlanQualitySummary {
  fullBundlesCovered: number;
  splitBundles: number;
  avoidableSplits: number;
  backupAssignments: number;
  avoidableBackupAssignments: number;
  nearCheckInTasks: number;
  manualDecisionCount: number;
  globalScore: number;
  criticalWarnings: string[];
}

export interface AssignmentProposalResult {
  proposals: AssignmentProposal[];
  conflicts: AssignmentConflict[];
  summary: {
    totalUnassignedTasks: number;
    proposedCount: number;
    conflictCount: number;
    proposedMinutes: number;
    remainingCapacityMinutes: number;
    missingCapacityMinutes: number;
    globalQuality?: GlobalPlanQualitySummary;
  };
}

export type PlanningDurationSource = 'property' | 'missing';

export interface CleaningPlanningTask extends Task {
  durationMinutes: number;
  durationSource: PlanningDurationSource;
  riskFlags: PlanningTaskRisk[];
  zone: string;
  detectedBuilding?: DetectedBuilding;
  assignmentProposal?: AssignmentProposal;
  displayStatus: string;
  displayType: string;
  displayStartTime: string;
  displayEndTime: string;
}

export type PlanningTaskFilter = 'all' | 'unassigned' | 'risks';

export interface CleaningPlanningFilters {
  taskFilter: PlanningTaskFilter;
  zone: string;
  search: string;
  cleanerId: string;
}

export interface CleanerPlanningDay {
  cleanerId: string;
  cleanerName: string;
  cleaner: Cleaner;
  tasks: CleaningPlanningTask[];
  plannedMinutes: number;
  capacityMinutes: number;
  utilizationPercent: number;
  riskFlags: PlanningTaskRisk[];
}

export interface CleaningPlanningSummary {
  totalTasks: number;
  assignedTasks: number;
  unassignedTasks: number;
  completedTasks: number;
  conflictTasks: number;
  overcapacityCleaners: number;
  plannedMinutes: number;
  capacityMinutes: number;
  utilizationPercent: number;
}

export interface CleaningPlanningModel {
  startDate: string;
  endDate: string;
  cleaners: CleanerPlanningDay[];
  unassignedTasks: CleaningPlanningTask[];
  summary: CleaningPlanningSummary;
}

export interface CleanerCapacityMap {
  [cleanerId: string]: number;
}
