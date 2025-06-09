
export type ReportType = 'tasks' | 'billing' | 'summary';

export type DateRange = 'today' | 'week' | 'month' | 'custom';

export interface ReportFilters {
  reportType: ReportType;
  dateRange: DateRange;
  startDate?: Date;
  endDate?: Date;
  clientId?: string;
  cleanerId?: string;
}

export interface TaskReport {
  id: string;
  property: string;
  address: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  status: string;
  cleaner: string;
  client: string;
}

export interface BillingReport {
  id: string;
  property: string;
  client: string;
  date: string;
  serviceType: string;
  duration: number;
  cost: number;
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
