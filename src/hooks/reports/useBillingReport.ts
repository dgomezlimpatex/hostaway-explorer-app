
import { useQuery } from '@tanstack/react-query';
import { ReportFilters } from '@/types/filters';
import { generateBillingReport } from '@/services/reports/billingReportGenerator';
import { useReportData } from './useReportData';

export const useBillingReport = (filters: ReportFilters) => {
  const { data: reportData, isLoading, error } = useReportData(filters);

  return useQuery({
    queryKey: ['billingReport', filters],
    queryFn: async () => {
      if (!reportData) throw new Error('Report data not available');
      return generateBillingReport(reportData.tasks, reportData.properties, reportData.clients);
    },
    enabled: !!reportData,
  });
};
