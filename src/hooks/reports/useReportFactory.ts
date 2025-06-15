
import { ReportFilters } from '@/types/filters';
import { useTaskReport } from './useTaskReport';
import { useBillingReport } from './useBillingReport';
import { useSummaryReport } from './useSummaryReport';
import { useLaundryReport } from './useLaundryReport';

export const useReportFactory = (filters: ReportFilters) => {
  const taskReport = useTaskReport(filters);
  const billingReport = useBillingReport(filters);
  const summaryReport = useSummaryReport(filters);
  const laundryReport = useLaundryReport(filters);

  switch (filters.reportType) {
    case 'tasks':
      return taskReport;
    case 'billing':
      return billingReport;
    case 'summary':
      return summaryReport;
    case 'laundry':
      return laundryReport;
    default:
      return taskReport;
  }
};
