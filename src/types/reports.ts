
import { BaseEntity, TimeRange, ServiceInfo } from './common';

export type ReportType = 'tasks' | 'billing' | 'summary' | 'laundry';

export interface TaskReport extends BaseEntity, TimeRange {
  property: string;
  address: string;
  date: string;
  type: string;
  status: string;
  cleaner: string;
  client: string;
  // Nuevos campos para exportación CSV
  serviceDate: string;
  supervisor: string;
  serviceType: string;
  taskStatus: string;
  totalCost: number;
  workTeam: string;
  paymentMethod: string;
  incidents: string;
}

export interface BillingReport extends BaseEntity, ServiceInfo {
  property: string;
  client: string;
  date: string;
  serviceType: string;
  status: string;
}

export interface SummaryReport {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  totalRevenue: number;
  averageTaskDuration: number;
  topCleaners: Array<{ name: string; tasks: number }>;
  topClients: Array<{ name: string; tasks: number }>;
}

export interface LaundryTextiles {
  sabanas: number;
  sabanasRequenas: number;
  toallasGrandes: number;
  toallasPequenas: number;
  alfombrines: number;
  fundasAlmohada: number;
}

export interface LaundryReport extends TaskReport {
  textiles: LaundryTextiles;
  bedrooms: number;
  bedroomsSmall: number;
  sofaBeds: number;
  bathrooms: number;
  kitAlimentario: number;
  amenitiesBano: number;
  amenitiesCocina: number;
  rollosPapelHigienico: number;
  rollosPapelCocina: number;
}
