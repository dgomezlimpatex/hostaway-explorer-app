export type PlanningRunStatus = 'draft' | 'approved' | 'discarded';

export type PlanningRoleType =
  | 'property-preferred'
  | 'building-primary'
  | 'building-secondary'
  | 'building-backup'
  | 'same-zone'
  | 'manual-review';

export type PlanningConflictCode =
  | 'missing-property'
  | 'missing-building'
  | 'missing-duration'
  | 'invalid-window'
  | 'outside-window'
  | 'missing-team'
  | 'no-candidate'
  | 'insufficient-team'
  | 'overlap'
  | 'over-capacity'
  | 'weekly-overload'
  | 'worker-unavailable'
  | 'worker-restriction'
  | 'missing-zone'
  | 'extraordinary-excluded';

export interface PlanningSettings {
  id?: string;
  sedeId?: string | null;
  horizonDays: number;
  bufferMinutes: number;
  allowBackups: boolean;
  excludeExtraordinary: boolean;
  approvalRequired: boolean;
  fallbackDailyCapacityMinutes: number;
  weeklyTolerancePercent: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlanningOverviewDay {
  date: string;
  tasks: number;
  unassigned: number;
  requiredMinutes: number;
  availableMinutes: number;
  deficitMinutes: number;
  criticalTasks: number;
}

export interface PlanningOverview {
  startDate: string;
  endDate: string;
  totalTasks: number;
  unassignedTasks: number;
  requiredMinutes: number;
  availableMinutes: number;
  activeAbsences: number;
  criticalTasks: number;
  deficitDays: number;
  days: PlanningOverviewDay[];
}

export type PlanningPredictiveAlertSeverity = 'info' | 'warning' | 'critical';

export type PlanningPredictiveAlertCategory =
  | 'capacity'
  | 'building-dependency'
  | 'building-coverage'
  | 'critical-task'
  | 'absence'
  | 'workload';

export interface PlanningPredictiveAlert {
  id: string;
  severity: PlanningPredictiveAlertSeverity;
  category: PlanningPredictiveAlertCategory;
  title: string;
  message: string;
  date?: string | null;
  propertyGroupId?: string | null;
  propertyGroupName?: string | null;
  cleanerId?: string | null;
  cleanerName?: string | null;
  count?: number;
}

export interface PlanningWorkerSummary {
  id: string;
  name: string;
  email?: string | null;
  zone?: string | null;
  contractHoursPerWeek?: number | null;
  maxDailyMinutes: number;
  activeAbsenceCount: number;
  fixedDaysOffCount: number;
  maintenanceCount: number;
  primaryBuildingCount: number;
  secondaryBuildingCount: number;
  backupBuildingCount: number;
  assignedBuildingNames: string[];
  planningCanHandleLinenLoad: boolean;
  planningCanHandleComplexCleanings: boolean;
  planningOperationalRestrictions?: string | null;
}

export interface PlanningBuildingSummary {
  id: string;
  name: string;
  displayName?: string | null;
  internalCode?: string | null;
  zone?: string | null;
  propertyCount: number;
  titularCount: number;
  substituteCount: number;
  backupCount: number;
  isActive: boolean;
}

export interface PlanningProposalCleaner {
  cleanerId: string;
  cleanerName: string;
  roleType: PlanningRoleType;
  score: number;
  reasons: string[];
  warnings: string[];
  projectedAssignedMinutes: number;
  projectedRemainingMinutes: number;
}

export type PlanningReplacementCandidate = PlanningProposalCleaner;

export interface PlanningRunItemProposal {
  taskId: string;
  taskDate: string;
  propertyId?: string | null;
  propertyCode: string;
  propertyName: string;
  propertyAddress: string;
  propertyGroupId?: string | null;
  propertyGroupName?: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  checkOut: string;
  checkIn: string;
  requiredCleaners: number;
  explanation: string;
  warnings: string[];
  roleSource: PlanningRoleType;
  proposedCleaners: PlanningProposalCleaner[];
}

export interface PlanningAbsenceReplacementTask {
  taskId: string;
  taskDate: string;
  propertyId?: string | null;
  propertyCode: string;
  propertyName: string;
  propertyGroupId?: string | null;
  propertyGroupName?: string | null;
  startTime: string;
  endTime: string;
  requiredCleaners: number;
  assignedCleanerIds: string[];
  assignedCleanerNames: string[];
  availableAssignedCleanerIds: string[];
  availableAssignedCleanerNames: string[];
  missingCleaners: number;
  explanation: string;
  warnings: string[];
  recommendedCleaners: PlanningReplacementCandidate[];
}

export interface PlanningAbsenceReplacement {
  absenceId: string;
  cleanerId: string;
  cleanerName: string;
  absenceType: string;
  startDate: string;
  endDate: string;
  affectedTasks: number;
  affectedBuildings: string[];
  items: PlanningAbsenceReplacementTask[];
}

export interface PlanningRunItem {
  id: string;
  runId: string;
  taskId: string;
  propertyId?: string | null;
  propertyGroupId?: string | null;
  proposedCleanerIds: string[];
  proposedCleanerNames: string[];
  roleSource: PlanningRoleType;
  explanation: string;
  warnings: string[];
  score: number;
  proposal: PlanningRunItemProposal;
  status: 'draft' | 'approved' | 'discarded' | 'applied';
  appliedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningConflict {
  id: string;
  runId: string;
  taskId?: string | null;
  code: PlanningConflictCode;
  message: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface PlanningPerformanceBuildingConflict {
  propertyGroupId?: string | null;
  propertyGroupName: string;
  conflictCount: number;
}

export interface PlanningPerformanceWorkerLoad {
  cleanerId: string;
  cleanerName: string;
  assignedMinutes: number;
  maxDailyMinutes: number;
  utilizationPercent: number;
  affectedDays: number;
}

export interface PlanningPerformanceDayPressure {
  date: string;
  deficitMinutes: number;
  unassigned: number;
  criticalTasks: number;
  requiredMinutes: number;
  availableMinutes: number;
  pressureScore: number;
}

export interface PlanningPerformanceOverview {
  automationRate: number;
  approvedRuns: number;
  plannedTasks: number;
  buildingsWithMostConflicts: PlanningPerformanceBuildingConflict[];
  overloadedWorkers: PlanningPerformanceWorkerLoad[];
  pressureDays: PlanningPerformanceDayPressure[];
  estimatedTimeSavedMinutes: number;
}

export interface PlanningMonthlyForecastMonth {
  monthKey: string;
  label: string;
  dateFrom: string;
  dateTo: string;
  cleanings: number;
  totalRevenue: number;
  totalMinutes: number;
  requiredCleanerSlots: number;
  recommendedStaff: number;
  activeProperties: number;
  pressureDays: number;
}

export interface PlanningMonthlyForecastProperty {
  propertyId: string;
  propertyCode: string;
  propertyName: string;
  clientName?: string | null;
  propertyGroupId?: string | null;
  propertyGroupName?: string | null;
  monthKey: string;
  monthLabel: string;
  cleanings: number;
  checkoutCleanings: number;
  stayCleanings: number;
  totalRevenue: number;
  totalMinutes: number;
  totalHours: number;
  requiredCleanerSlots: number;
  recommendedStaff: number;
  peakDailyCleanings: number;
  peakDailyMinutes: number;
  cleaningDays: number;
  weekendCleanings: number;
  tightWindowCleanings: number;
  averageRevenuePerCleaning: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskReasons: string[];
}

export interface PlanningMonthlyForecastResponse {
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  months: PlanningMonthlyForecastMonth[];
  properties: PlanningMonthlyForecastProperty[];
  summary: {
    cleanings: number;
    totalRevenue: number;
    totalMinutes: number;
    totalHours: number;
    requiredCleanerSlots: number;
    recommendedStaffPeak: number;
    pressureDays: number;
    activeProperties: number;
  };
}

export interface PlanningRunSummary {
  totalTasks: number;
  proposedTasks: number;
  proposedAssignments: number;
  requiredMinutes: number;
  proposedMinutes: number;
  conflictCount: number;
  deficitMinutes: number;
  criticalTasks: number;
}

export interface PlanningRun {
  id: string;
  sedeId?: string | null;
  dateFrom: string;
  dateTo: string;
  status: PlanningRunStatus;
  summary: PlanningRunSummary;
  generatedBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  discardedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningNotificationBatch {
  id: string;
  runId: string;
  cleanerId: string;
  cleanerEmail?: string | null;
  cleanerName: string;
  taskDate: string;
  taskIds: string[];
  notificationKey: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningPreviewData {
  run: PlanningRun;
  items: PlanningRunItem[];
  conflicts: PlanningConflict[];
}

export interface PlanningGenerateInput {
  sedeId: string;
  dateFrom: string;
  dateTo: string;
}

export interface PlanningReplacementApplyResult {
  taskId: string;
  assignedCleanerIds: string[];
  assignedCleanerNames: string[];
  replacedCleanerIds: string[];
}

export interface PlanningApprovalResult {
  run: PlanningRun;
  appliedTasks: number;
  notificationBatches: number;
}

export interface PlanningOverviewResponse {
  overview: PlanningOverview;
  settings: PlanningSettings;
  latestRun: PlanningRun | null;
  alerts: PlanningPredictiveAlert[];
  substitutions: PlanningAbsenceReplacement[];
  performance: PlanningPerformanceOverview;
}
