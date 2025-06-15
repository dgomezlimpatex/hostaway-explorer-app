
import { useQuery } from '@tanstack/react-query';
import { ReportFilters } from '@/types/filters';
import { generateTaskReport } from '@/services/reports/taskReportGenerator';
import { useReportData } from './useReportData';

export const useTaskReport = (filters: ReportFilters) => {
  const { data: reportData, isLoading, error } = useReportData(filters);

  return useQuery({
    queryKey: ['taskReport', filters],
    queryFn: async () => {
      if (!reportData) throw new Error('Report data not available');
      return generateTaskReport(reportData.tasks, reportData.properties, reportData.clients);
    },
    enabled: !!reportData,
  });
};
