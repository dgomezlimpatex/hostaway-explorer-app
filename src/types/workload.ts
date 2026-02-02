// Types for workload calculation system

export interface HourAdjustment {
  id: string;
  cleanerId: string;
  date: string;
  hours: number; // Positive = add, Negative = subtract
  category: 'extra' | 'training' | 'absence' | 'correction' | 'other';
  reason: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHourAdjustmentInput {
  cleanerId: string;
  date: string;
  hours: number;
  category: HourAdjustment['category'];
  reason: string;
  notes?: string;
}

export interface UpdateHourAdjustmentInput {
  id: string;
  hours?: number;
  category?: HourAdjustment['category'];
  reason?: string;
  notes?: string;
}

export interface WorkloadSummary {
  cleanerId: string;
  cleanerName: string;
  contractHoursPerWeek: number;
  
  // Tourist hours (from assigned tasks, not cancelled)
  touristHours: number;
  touristTaskCount: number;
  
  // Maintenance hours (fixed weekly from worker_maintenance_cleanings)
  maintenanceHours: number;
  
  // Manual adjustments
  adjustmentHours: number; // Can be positive or negative
  adjustments: HourAdjustment[];
  
  // Totals
  totalWorked: number; // tourist + maintenance + adjustments
  remainingHours: number;
  overtimeHours: number;
  
  // Status
  status: 'on-track' | 'overtime' | 'deficit' | 'critical-deficit';
  percentageComplete: number;
}

export interface WorkloadPeriod {
  startDate: string;
  endDate: string;
  type: 'weekly' | 'monthly';
}

export type AdjustmentCategory = HourAdjustment['category'];

export const ADJUSTMENT_CATEGORIES: { value: AdjustmentCategory; label: string }[] = [
  { value: 'extra', label: 'Horas Extra' },
  { value: 'training', label: 'Formación' },
  { value: 'absence', label: 'Ausencia' },
  { value: 'correction', label: 'Corrección' },
  { value: 'other', label: 'Otro' },
];

export const getStatusColor = (status: WorkloadSummary['status']): string => {
  switch (status) {
    case 'on-track':
      return 'text-green-600';
    case 'overtime':
      return 'text-amber-600';
    case 'deficit':
      return 'text-amber-600';
    case 'critical-deficit':
      return 'text-red-600';
    default:
      return 'text-muted-foreground';
  }
};

export const getStatusBgColor = (status: WorkloadSummary['status']): string => {
  switch (status) {
    case 'on-track':
      return 'bg-green-100';
    case 'overtime':
      return 'bg-amber-100';
    case 'deficit':
      return 'bg-amber-100';
    case 'critical-deficit':
      return 'bg-red-100';
    default:
      return 'bg-muted';
  }
};

export const getProgressBarColor = (status: WorkloadSummary['status']): string => {
  switch (status) {
    case 'on-track':
      return 'bg-green-500';
    case 'overtime':
      return 'bg-amber-500';
    case 'deficit':
      return 'bg-amber-500';
    case 'critical-deficit':
      return 'bg-red-500';
    default:
      return 'bg-muted';
  }
};
