
import { ReportType } from './reports';

export type DateRange = 'today' | 'week' | 'month' | 'custom' | 'all' | 'tomorrow' | 'this-week' | 'next-week';

export interface BaseFilters {
  dateRange: DateRange;
  startDate?: Date;
  endDate?: Date;
  clientId?: string;
  cleanerId?: string;
  sedeId?: string; // Nuevo filtro por sede
}

export interface ReportFilters extends BaseFilters {
  reportType: ReportType;
}

export interface TaskFilters extends BaseFilters {
  status?: 'pending' | 'in-progress' | 'completed' | 'all';
  propertyId?: string;
  cleaner?: string;
  cliente?: string;
  propiedad?: string;
}

export interface CalendarFilters extends BaseFilters {
  workerId?: string;
  showUnassigned?: boolean;
}
