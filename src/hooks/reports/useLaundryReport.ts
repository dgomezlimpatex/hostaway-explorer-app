
import { useQuery } from '@tanstack/react-query';
import { ReportFilters } from '@/types/filters';
import { generateLaundryReport } from '@/services/reports/laundryReportGenerator';
import { useReportData } from './useReportData';

export const useLaundryReport = (filters: ReportFilters) => {
  const { data: reportData, isLoading, error } = useReportData(filters);

  return useQuery({
    queryKey: ['laundryReport', filters],
    queryFn: async () => {
      if (!reportData) throw new Error('Report data not available');
      return generateLaundryReport(reportData.tasks, reportData.properties, reportData.clients);
    },
    enabled: !!reportData,
  });
};
