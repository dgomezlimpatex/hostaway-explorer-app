
import { useQuery } from '@tanstack/react-query';
import { ReportFilters } from '@/types/reports';
import { taskStorageService } from '@/services/taskStorage';
import { clientStorage } from '@/services/clientStorage';
import { propertyStorage } from '@/services/propertyStorage';
import { filterTasksByDateRange, applyAdditionalFilters } from '@/services/reports/dateFilters';
import { generateSummaryReport } from '@/services/reports/summaryReportGenerator';

export const useSummaryReport = (filters: ReportFilters) => {
  return useQuery({
    queryKey: ['summaryReport', filters],
    queryFn: async () => {
      const tasks = await taskStorageService.getTasks();
      const clients = await clientStorage.getAll();
      const properties = await propertyStorage.getAll();
      
      const filteredByDate = filterTasksByDateRange(tasks, filters);
      const finalTasks = applyAdditionalFilters(filteredByDate, filters, properties);
      
      return generateSummaryReport(finalTasks);
    },
  });
};
