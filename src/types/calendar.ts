import { BaseEntity } from './common';

export interface Cleaner extends BaseEntity {
  name: string;
  email?: string;
  telefono?: string;
  avatar?: string;
  isActive: boolean;
  sortOrder?: number;
  user_id?: string;
  contractHoursPerWeek?: number;
  hourlyRate?: number;
  contractType?: string;
  startDate?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
}

export type ViewType = 'day' | 'three-day' | 'week';

export interface Task extends BaseEntity {
  property: string;
  propertyCode?: string;
  address: string;
  date: string;
  startTime: string;
  endTime: string;
  duration?: number;
  checkIn: string;
  checkOut: string;
  type: string;
  status: 'pending' | 'in-progress' | 'completed';
  cleaner?: string;
  cleanerId?: string;
  client?: string;
  clienteId?: string;
  propertyId?: string;
  cost?: number;
  paymentMethod?: string;
  supervisor?: string;
  backgroundColor?: string;
  notes?: string;
  originalTaskId?: string; // Para tareas con asignaciones múltiples, guarda el ID original
  // Extraordinary service billing fields
  extraordinaryClientName?: string;
  extraordinaryClientEmail?: string;
  extraordinaryClientPhone?: string;
  extraordinaryBillingAddress?: string;
}

export interface Assignment {
  taskId: string;
  cleanerId: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface CleanerAvailability {
  cleanerId: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  isAvailable: boolean;
  startTime?: string; // formato HH:MM
  endTime?: string; // formato HH:MM
}

export interface TimeLog extends BaseEntity {
  cleanerId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  breakDurationMinutes: number;
  totalHours: number;
  overtimeHours: number;
  notes?: string;
  workedHours: number;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  // New fields from Phase 1
  taskId?: string;
  baseSalary?: number;
  overtimeMultiplier?: number;
  vacationHoursAccrued?: number;
  vacationHoursUsed?: number;
}

export interface WorkSchedule extends BaseEntity {
  cleanerId: string;
  date: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  isWorkingDay: boolean;
  scheduleType: 'regular' | 'overtime' | 'holiday';
  notes?: string;
}

// New interfaces from Phase 1
export interface WorkerContract extends BaseEntity {
  cleanerId: string;
  contractType: 'full-time' | 'part-time' | 'temporary' | 'freelance';
  startDate: string;
  endDate?: string;
  baseSalary: number;
  hourlyRate?: number;
  overtimeRate: number;
  vacationDaysPerYear: number;
  sickDaysPerYear: number;
  contractHoursPerWeek: number;
  paymentFrequency: 'weekly' | 'biweekly' | 'monthly';
  benefits: Record<string, any>;
  notes?: string;
  isActive: boolean;
}

export interface VacationRequest extends BaseEntity {
  cleanerId: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  requestType: 'vacation' | 'sick' | 'personal';
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  notes?: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

// Extended types for Phase 2-6
export interface WorkerHoursOverview {
  cleanerId: string;
  contractHours: number;
  workedHours: number;
  remainingHours: number;
  overtimeHours: number;
  efficiencyRate: number;
  weeklyProjection: number;
  monthlyProjection: number;
}

export interface WorkerAlert {
  type: 'hours_exceeded' | 'hours_deficit' | 'vacation_pending' | 'schedule_conflict';
  severity: 'low' | 'medium' | 'high' | 'critical';
  cleanerId: string;
  message: string;
  actionRequired: boolean;
  suggestedAction?: string;
}

export interface TaskTimeBreakdown {
  taskId: string;
  taskName: string;
  taskType: string;
  timeSpent: number;
  scheduledTime: number;
  efficiency: number;
  date: string;
}

export interface SalaryCalculation {
  cleanerId: string;
  period: { startDate: Date; endDate: Date };
  contract: {
    hourlyRate: number;
    overtimeRate: number;
    contractHoursPerWeek: number;
    vacationDaysPerYear: number;
  };
  hours: {
    regular: number;
    overtime: number;
    vacation: number;
    total: number;
  };
  pay: {
    regular: number;
    overtime: number;
    vacation: number;
    gross: number;
  };
  deductions: {
    socialSecurity: number;
    taxes: number;
    total: number;
  };
  netPay: number;
  generatedAt: Date;
}