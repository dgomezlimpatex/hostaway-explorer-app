import { Cleaner, Task } from './calendar';

export type PlanningTaskRisk = 'unassigned' | 'overlap' | 'overcapacity' | 'missing-time';

export type PlanningRangePreset = 'today' | 'tomorrow' | 'week';

export interface CleaningPlanningTask extends Task {
  durationMinutes: number;
  riskFlags: PlanningTaskRisk[];
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
