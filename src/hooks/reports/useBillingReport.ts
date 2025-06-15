
import { useQuery } from '@tanstack/react-query';
import { ReportFilters } from '@/types/filters';
import { taskStorageService } from '@/services/taskStorage';
import { clientStorage } from '@/services/clientStorage';
import { propertyStorage } from '@/services/propertyStorage';
import { filterTasksByDateRange, applyAdditionalFilters } from '@/services/reports/dateFilters';
import { generateBillingReport } from '@/services/reports/billingReportGenerator';

export const useBillingReport = (filters: ReportFilters) => {
  return useQuery({
    queryKey: ['billingReport', filters],
    queryFn: async () => {
      const tasks = await taskStorageService.getTasks();
      const clients = await clientStorage.getAll();
      const properties = await propertyStorage.getAll();
      
      const filteredByDate = filterTasksByDateRange(tasks, filters);
      const finalTasks = applyAdditionalFilters(filteredByDate, filters, properties);
      
      return generateBillingReport(finalTasks, properties, clients);
    },
  });
};
