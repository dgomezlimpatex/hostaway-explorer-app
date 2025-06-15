
import { ReportType } from './reports';

export type DateRange = 'today' | 'week' | 'month' | 'custom';

export interface BaseFilters {
  dateRange: DateRange;
  startDate?: Date;
  endDate?: Date;
  clientId?: string;
  cleanerId?: string;
}

export interface ReportFilters extends BaseFilters {
  reportType: ReportType;
}

export interface TaskFilters extends BaseFilters {
  status?: 'pending' | 'in-progress' | 'completed';
  propertyId?: string;
}

export interface CalendarFilters extends BaseFilters {
  workerId?: string;
  showUnassigned?: boolean;
}
