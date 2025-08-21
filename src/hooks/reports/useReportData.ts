
import { useQuery } from '@tanstack/react-query';
import { ReportFilters } from '@/types/filters';
import { taskStorageService } from '@/services/taskStorage';
import { clientStorage } from '@/services/clientStorage';
import { propertyStorage } from '@/services/propertyStorage';
import { filterTasksByDateRange, applyAdditionalFilters } from '@/services/reports/dateFilters';
import { useSede } from '@/contexts/SedeContext';
import { useAuth } from '@/hooks/useAuth';

export const useReportData = (filters: ReportFilters) => {
  const { user } = useAuth();
  const { activeSede } = useSede();

  return useQuery({
    queryKey: ['reportData', filters, activeSede?.id],
    queryFn: async () => {
      // Por ahora, usar los servicios estándar con filtro automático
      // TODO: Implementar métodos getAllWithoutSedeFilter y getBySedeId
      const tasks = await taskStorageService.getTasks();
      const clients = await clientStorage.getAll();
      const properties = await propertyStorage.getAll();
      
      const filteredByDate = filterTasksByDateRange(tasks, filters);
      const finalTasks = applyAdditionalFilters(filteredByDate, filters, properties);
      
      return { 
        tasks: finalTasks, 
        clients, 
        properties,
        sedeInfo: activeSede // Incluir info de sede para uso en reportes
      };
    },
  });
};
