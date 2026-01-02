
import { BaseEntity, TimeRange, ServiceInfo } from './common';

export type ReportType = 'tasks' | 'billing' | 'summary' | 'laundry' | 'client-billing';

// Client Billing Types
export interface TaskBillingDetail {
  taskId: string;
  date: string;
  type: string;
  duration: number;
  cost: number;
  status: string;
  cleaner: string;
  checkIn: string;
  checkOut: string;
}

export interface PropertyBillingDetail {
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  direccion: string;
  totalCleanings: number;
  totalCost: number;
  tasks: TaskBillingDetail[];
}

export interface ClientBillingReport {
  clientId: string;
  clientName: string;
  cifNif: string;
  direccionFacturacion: string;
  metodoPago: string;
  totalServices: number;
  totalCost: number;
  properties: PropertyBillingDetail[];
}

export interface TaskReport {
  sede?: string; // Nueva propiedad para información de sede
  serviceDate: string;
  supervisor: string;
  client: string;
  serviceType: string;
  taskStatus: string;
  totalCost: number;
  serviceHours: number;
  workTeam: string;
  paymentMethod: string;
  incidents: string;
  // Propiedades heredadas existentes
  id: string;
  created_at: string;
  updated_at: string;
  property: string;
  address: string;
  date: string;
  type: string;
  status: string;
  cleaner: string;
  startTime: string;
  endTime: string;
}

export interface BillingReport {
  sede?: string; // Nueva propiedad para información de sede
  property: string;
  client: string;
  date: string;
  serviceType: string;
  duration: number;
  cost: number;
  status: 'pending' | 'in-progress' | 'completed';
  // Propiedades heredadas existentes
  id: string;
  created_at: string;
  updated_at: string;
  type: string;
  supervisor: string;
}

export interface LaundryReport {
  sede?: string; // Nueva propiedad para información de sede
  property: string;
  propertyCode: string;
  address: string;
  date: string;
  startTime: string;
  endTime: string;
  client: string;
  cleaner: string;
  textiles?: {
    sabanas: number;
    sabanasRequenas: number;
    sabanasSuite: number;
    toallasGrandes: number;
    toallasPequenas: number;
    alfombrines: number;
    fundasAlmohada: number;
  };
  kitAlimentario: number;
  bedrooms: number;
  bedroomsSmall: number;
  bedroomsSuite: number;
  sofaBeds: number;
  bathrooms: number;
  amenitiesBano: number;
  amenitiesCocina: number;
  rollosPapelHigienico: number;
  rollosPapelCocina: number;
  // Propiedades heredadas de TaskReport
  id: string;
  created_at: string;
  updated_at: string;
  type: string;
  status: string;
  serviceDate: string;
  supervisor: string;
  serviceType: string;
  taskStatus: string;
  totalCost: number;
  serviceHours: number;
  workTeam: string;
  paymentMethod: string;
  incidents: string;
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
