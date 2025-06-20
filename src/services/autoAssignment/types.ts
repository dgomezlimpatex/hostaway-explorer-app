
import { Task } from '@/types/calendar';
import { PropertyGroup, CleanerGroupAssignment, AssignmentPattern } from '@/types/propertyGroups';

export interface AssignmentContext {
  task: Task;
  propertyGroup: PropertyGroup;
  cleanerAssignments: CleanerGroupAssignment[];
  existingTasks: Task[];
  patterns: AssignmentPattern[];
}

export interface AssignmentResult {
  cleanerId: string | null;
  cleanerName: string | null;
  confidence: number;
  reason: string;
  algorithm: string;
}

export interface CleanerInfo {
  name: string;
}
