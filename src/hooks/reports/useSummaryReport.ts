
import { useQuery } from '@tanstack/react-query';
import { ReportFilters } from '@/types/filters';
import { generateSummaryReport } from '@/services/reports/summaryReportGenerator';
import { useReportData } from './useReportData';

export const useSummaryReport = (filters: ReportFilters) => {
  const { data: reportData, isLoading, error } = useReportData(filters);

  return useQuery({
    queryKey: ['summaryReport', filters],
    queryFn: async () => {
      if (!reportData) throw new Error('Report data not available');
      return generateSummaryReport(reportData.tasks);
    },
    enabled: !!reportData,
  });
};
