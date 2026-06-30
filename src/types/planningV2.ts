import { Cleaner, CleanerAvailability, Task, WorkerContract } from '@/types/calendar';
import { Property } from '@/types/property';
import { PropertyGroup } from '@/types/propertyGroups';

export type PlanningStaffingScope = 'property' | 'group';

export type PlanningStaffingRole = 'primary' | 'secondary' | 'backup' | 'excluded';

export interface PlanningStaffingEntry {
  id?: string;
  scope: PlanningStaffingScope;
  scopeId: string;
  cleanerId: string;
  role: PlanningStaffingRole;
  priority: number;
  maxTasksPerDay?: number;
  estimatedTravelTimeMinutes?: number;
  notes?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  cleanerName?: string;
}

export interface PlanningStaffingConfig {
  scope: PlanningStaffingScope;
  scopeId: string;
  entries: PlanningStaffingEntry[];
}

export interface PlanningPropertyBuildingAssignment {
  propertyId: string;
  propertyCode: string;
  propertyName: string;
  buildingPrefix: string;
  groupId?: string;
  groupName?: string;
}

export interface PlanningPropertyContext {
  property: Property;
  propertyGroup?: PropertyGroup;
  propertyStaffing: PlanningStaffingEntry[];
  groupStaffing: PlanningStaffingEntry[];
  effectiveStaffing: PlanningStaffingEntry[];
  availability: CleanerAvailability[];
  workerContracts: WorkerContract[];
  existingTasks: Task[];
}

export interface PlanningStaffingUpsertInput {
  scope: PlanningStaffingScope;
  scopeId: string;
  cleanerId: string;
  role: PlanningStaffingRole;
  maxTasksPerDay?: number;
  estimatedTravelTimeMinutes?: number;
  notes?: string | null;
}

export interface PlanningStaffingReplaceInput {
  scope: PlanningStaffingScope;
  scopeId: string;
  entries: Array<Omit<PlanningStaffingUpsertInput, 'scope' | 'scopeId'>>;
}

export interface PlanningV2BusinessRules {
  centerModel: 'property';
  buildingModel: 'property-code-prefix';
  defaultBufferMinutes: number;
  createsTasks: false;
  largeHousePeopleRange: [number, number];
}

export const PLANNING_V2_BUSINESS_RULES: PlanningV2BusinessRules = {
  centerModel: 'property',
  buildingModel: 'property-code-prefix',
  defaultBufferMinutes: 30,
  createsTasks: false,
  largeHousePeopleRange: [2, 3],
};
