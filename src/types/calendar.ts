
import { BaseEntity } from './common';

export interface Cleaner extends BaseEntity {
  name: string;
  email?: string;
  telefono?: string;
  avatar?: string;
  isActive: boolean;
  sortOrder?: number;
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
