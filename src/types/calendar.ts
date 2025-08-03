
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
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
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
