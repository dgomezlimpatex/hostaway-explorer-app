
import { useQuery } from '@tanstack/react-query';
import { ReportFilters } from '@/types/filters';
import { taskStorageService } from '@/services/taskStorage';
import { clientStorage } from '@/services/clientStorage';
import { propertyStorage } from '@/services/propertyStorage';
import { useSede } from '@/contexts/SedeContext';
import { useAuth } from '@/hooks/useAuth';

export const useReportData = (filters: ReportFilters) => {
  const { user } = useAuth();
  const { activeSede } = useSede();

  return useQuery({
    queryKey: ['reportData', filters, activeSede?.id],
    queryFn: async () => {
      // Calcular rango de fechas basado en los filtros
      const today = new Date();
      let dateFrom: string;
      let dateTo: string;
      
      // Determinar rango de fechas según el filtro dateRange
      switch (filters.dateRange) {
        case 'today':
          dateFrom = dateTo = today.toISOString().split('T')[0];
          break;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          dateFrom = dateTo = yesterday.toISOString().split('T')[0];
          break;
        case 'tomorrow':
          const tomorrow = new Date(today);
          tomorrow.setDate(today.getDate() + 1);
          dateFrom = dateTo = tomorrow.toISOString().split('T')[0];
          break;
        case 'week':
        case 'this-week':
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay() + 1);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          dateFrom = weekStart.toISOString().split('T')[0];
          dateTo = weekEnd.toISOString().split('T')[0];
          break;
        case 'next-week':
          const nextWeekStart = new Date(today);
          nextWeekStart.setDate(today.getDate() - today.getDay() + 8);
          const nextWeekEnd = new Date(nextWeekStart);
          nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
          dateFrom = nextWeekStart.toISOString().split('T')[0];
          dateTo = nextWeekEnd.toISOString().split('T')[0];
          break;
        case 'month':
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          dateFrom = monthStart.toISOString().split('T')[0];
          dateTo = monthEnd.toISOString().split('T')[0];
          break;
        case 'custom':
          dateFrom = filters.startDate?.toISOString().split('T')[0] || today.toISOString().split('T')[0];
          dateTo = filters.endDate?.toISOString().split('T')[0] || today.toISOString().split('T')[0];
          break;
        case 'all':
        default:
          // Por defecto último mes
          const defaultStart = new Date(today);
          defaultStart.setMonth(defaultStart.getMonth() - 1);
          dateFrom = defaultStart.toISOString().split('T')[0];
          dateTo = today.toISOString().split('T')[0];
      }
      
      // Usar el nuevo método optimizado que filtra en base de datos
      const tasks = await taskStorageService.getTasksForReports({
        dateFrom,
        dateTo,
        sedeId: filters.sedeId || activeSede?.id,
        clienteId: filters.clientId,
      });
      
      // Cargar clientes y propiedades en paralelo
      const [clients, properties] = await Promise.all([
        clientStorage.getAll(),
        propertyStorage.getAll()
      ]);
      
      return { 
        tasks, 
        clients, 
        properties,
        sedeInfo: activeSede
      };
    },
  });
};
