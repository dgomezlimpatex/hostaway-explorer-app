export type PlanningV2Sede = 'a-coruna' | 'ourense' | 'benidorm' | string;

export interface PlanningV2PropertyRef {
  id: string;
  code: string;
  name?: string;
  sedeId: PlanningV2Sede;
  estimatedCleaningMinutes?: number;
  isLargeHome?: boolean;
  requiredCleaners?: number;
}

export type PropertyGroupingKind = 'building' | 'single_property' | 'unknown';

export interface PropertyGroupingResult {
  propertyId: string;
  propertyCode: string;
  workCenterId: string;
  buildingGroupId: string;
  buildingCode: string;
  kind: PropertyGroupingKind;
  confidence: number;
  reasons: string[];
}

export interface CleaningTurnoverInput {
  taskId: string;
  propertyId: string;
  checkoutAt?: string | Date | null;
  checkinAt?: string | Date | null;
  fallbackDate?: string;
  fallbackStartTime?: string;
  fallbackEndTime?: string;
  durationMinutes?: number | null;
}

export type CleaningWindowStatus = 'ready' | 'missing_checkout' | 'missing_checkin' | 'invalid' | 'insufficient_time';

export interface CleaningWindow {
  taskId: string;
  propertyId: string;
  startsAt: Date | null;
  endsAt: Date | null;
  durationMinutes: number | null;
  availableMinutes: number | null;
  bufferMinutes: number;
  status: CleaningWindowStatus;
  reasons: string[];
}

export interface PlanningV2CleanerRef {
  id: string;
  name: string;
  sedeId: PlanningV2Sede;
  homeBuildingGroupIds?: string[];
  preferredPropertyIds?: string[];
  maxMinutesPerDay?: number;
}

export interface CleanerAvailabilityWindow {
  cleanerId: string;
  startsAt: string | Date;
  endsAt: string | Date;
}

export interface PlanningV2TaskRef {
  id: string;
  propertyId: string;
  propertyCode?: string;
  sedeId: PlanningV2Sede;
  startsAt: string | Date;
  endsAt: string | Date;
  durationMinutes: number;
  cleanerIds: string[];
  requiredCleaners?: number;
}

export interface CleanerLoad {
  cleanerId: string;
  taskIds: string[];
  assignedMinutes: number;
  assignedTaskCount: number;
  multiPersonTaskCount: number;
  capacityMinutes: number;
  remainingMinutes: number;
  utilization: number;
}

export interface AssignmentScoringInput {
  taskId: string;
  property: PlanningV2PropertyRef;
  window: CleaningWindow;
  requiredCleaners?: number;
  cleaners: PlanningV2CleanerRef[];
  loads: Record<string, CleanerLoad>;
  availabilityWindows?: CleanerAvailabilityWindow[];
  existingAssignments?: PlanningV2TaskRef[];
}

export type CandidateRejectionCode =
  | 'different_sede'
  | 'no_cleaning_window'
  | 'availability_mismatch'
  | 'over_capacity'
  | 'time_overlap';

export interface AssignmentCandidate {
  cleanerId: string;
  cleanerName: string;
  score: number;
  canAssign: boolean;
  reasons: string[];
  warnings: string[];
  rejectionCodes: CandidateRejectionCode[];
  projectedLoad: CleanerLoad;
}

export interface TeamAssignmentCandidate {
  cleanerIds: string[];
  cleanerNames: string[];
  score: number;
  canAssign: boolean;
  reasons: string[];
  warnings: string[];
  candidates: AssignmentCandidate[];
}
