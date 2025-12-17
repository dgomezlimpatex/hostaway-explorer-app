// Types for Worker Absence Management System

export type AbsenceType = 'vacation' | 'sick' | 'day_off' | 'holiday' | 'personal' | 'external_work';
export type ReferenceType = 'absence' | 'fixed_day_off' | 'maintenance_cleaning';
export type AuditAction = 'created' | 'updated' | 'deleted';

export interface WorkerAbsence {
  id: string;
  cleanerId: string;
  startDate: string;
  endDate: string;
  startTime: string | null; // null = full day
  endTime: string | null;   // null = full day
  absenceType: AbsenceType;
  locationName: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerFixedDayOff {
  id: string;
  cleanerId: string;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerMaintenanceCleaning {
  id: string;
  cleanerId: string;
  daysOfWeek: number[]; // Array of days [1, 3] = Monday, Wednesday
  startTime: string;
  endTime: string;
  locationName: string;
  notes: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerAbsenceAuditLog {
  id: string;
  referenceId: string | null;
  referenceType: ReferenceType;
  action: AuditAction;
  cleanerId: string;
  oldData: Record<string, any> | null;
  newData: Record<string, any> | null;
  changedBy: string | null;
  changedAt: string;
}

// Input types for creating/updating
export interface CreateWorkerAbsenceInput {
  cleanerId: string;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  absenceType: AbsenceType;
  locationName?: string | null;
  notes?: string | null;
}

export interface UpdateWorkerAbsenceInput extends Partial<CreateWorkerAbsenceInput> {
  id: string;
}

export interface CreateWorkerMaintenanceCleaningInput {
  cleanerId: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  locationName: string;
  notes?: string | null;
}

export interface UpdateWorkerMaintenanceCleaningInput extends Partial<CreateWorkerMaintenanceCleaningInput> {
  id: string;
  isActive?: boolean;
}

// Conflict detection types
export interface WorkerConflict {
  type: 'fixed_day_off' | 'absence' | 'maintenance';
  reason: string;
  absenceType?: AbsenceType;
  timeRange?: string;
  locationName?: string;
}

export interface WorkerAvailabilityResult {
  available: boolean;
  conflicts: WorkerConflict[];
}

// UI helper types
export const ABSENCE_TYPE_CONFIG: Record<AbsenceType, { label: string; color: string; icon: string }> = {
  vacation: { label: 'Vacaciones', color: '#3B82F6', icon: '🏖️' },
  sick: { label: 'Baja médica', color: '#F97316', icon: '🤒' },
  day_off: { label: 'Día libre', color: '#6B7280', icon: '📅' },
  holiday: { label: 'Festivo', color: '#EF4444', icon: '🎉' },
  personal: { label: 'Personal', color: '#8B5CF6', icon: '👤' },
  external_work: { label: 'Trabajo externo', color: '#92400E', icon: '🏢' },
};

// Helper exports for easy access
export const ABSENCE_TYPE_LABELS: Record<string, string> = {
  vacation: 'Vacaciones',
  sick: 'Baja médica',
  day_off: 'Día libre',
  holiday: 'Festivo',
  personal: 'Personal',
  external_work: 'Trabajo externo',
};

export const ABSENCE_TYPE_COLORS: Record<string, string> = {
  vacation: '#3B82F6',
  sick: '#F97316',
  day_off: '#6B7280',
  holiday: '#EF4444',
  personal: '#8B5CF6',
  external_work: '#92400E',
};

export const MAINTENANCE_COLOR = '#EAB308'; // Yellow for maintenance cleanings

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

export const DAY_OF_WEEK_SHORT: Record<number, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
};
