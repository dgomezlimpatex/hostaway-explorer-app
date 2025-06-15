
import { ReportFilters } from '@/types/reports';
import { useReportFactory } from './reports/useReportFactory';

export const useReports = (filters: ReportFilters) => {
  return useReportFactory(filters);
};
