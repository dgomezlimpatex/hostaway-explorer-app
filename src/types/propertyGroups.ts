
export interface PropertyGroup {
  id: string;
  name: string;
  internalCode?: string;
  displayName?: string;
  zone?: string;
  clientName?: string;
  supervisorName?: string;
  generalInstructions?: string;
  difficultyLevel?: number;
  recommendedCapacity?: number;
  planningNotes?: string;
  description?: string;
  checkOutTime: string;
  checkInTime: string;
  isActive: boolean;
  autoAssignEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyGroupAssignment {
  id: string;
  propertyGroupId: string;
  propertyId: string;
  createdAt: string;
}

export interface CleanerGroupAssignment {
  id: string;
  propertyGroupId: string;
  cleanerId: string;
  priority: number;
  roleType?: 'primary' | 'secondary' | 'backup';
  knowledgeLevel?: number;
  maxTasksPerDay: number;
  maxDailyMinutesOverride?: number | null;
  estimatedTravelTimeMinutes: number;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AutoAssignmentRule {
  id: string;
  propertyGroupId: string;
  algorithm: 'round-robin' | 'workload-balance' | 'availability-first';
  maxConcurrentTasks: number;
  bufferTimeMinutes: number;
  considerTravelTime: boolean;
  learnFromHistory: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentPattern {
  id: string;
  propertyGroupId: string;
  cleanerId: string;
  dayOfWeek?: number;
  hourOfDay?: number;
  avgCompletionTimeMinutes?: number;
  successRate?: number;
  preferenceScore?: number;
  lastUpdated: string;
  sampleSize: number;
}

export interface AutoAssignmentLog {
  id: string;
  taskId: string;
  propertyGroupId?: string;
  assignedCleanerId?: string;
  algorithmUsed?: string;
  assignmentReason?: string;
  confidenceScore?: number;
  wasManualOverride: boolean;
  createdAt: string;
}
