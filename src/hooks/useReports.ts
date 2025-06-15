
import { ReportFilters } from '@/types/filters';
import { useReportFactory } from './reports/useReportFactory';

export const useReports = (filters: ReportFilters) => {
  return useReportFactory(filters);
};
