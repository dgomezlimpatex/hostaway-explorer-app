import { useQuery } from '@tanstack/react-query';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import { useSede } from '@/contexts/SedeContext';
import { useCleaners } from '@/hooks/useCleaners';
import { useAllWorkerMaintenanceCleanings } from '@/hooks/useWorkerMaintenanceCleanings';
import { taskStorageService } from '@/services/storage/taskStorage';
import { getTodayMadrid } from '@/utils/date';
import { buildDashboardWeeklyWorkload } from '@/utils/dashboardWeeklyWorkload';

export const useDashboardWeeklyWorkload = () => {
  const { activeSede, loading: sedeLoading, isInitialized } = useSede();
  const { cleaners, isLoading: cleanersLoading, error: cleanersError } = useCleaners();
  const maintenance = useAllWorkerMaintenanceCleanings();
  const now = getTodayMadrid();
  const startDate = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const endDate = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const tasks = useQuery({
    queryKey: ['planning-weekly-workload', 'dashboard', activeSede?.id, startDate, endDate],
    queryFn: () => taskStorageService.getTasks({ dateFrom: startDate, dateTo: endDate, sedeId: activeSede!.id }),
    enabled: Boolean(isInitialized && !sedeLoading && activeSede),
    staleTime: 0,
    refetchInterval: 15000,
  });
  const error = cleanersError || maintenance.error || tasks.error;
  const isLoading = sedeLoading || !isInitialized || !activeSede || cleanersLoading || maintenance.isLoading || tasks.isLoading;
  return {
    data: !isLoading && !error ? buildDashboardWeeklyWorkload(tasks.data || [], cleaners, maintenance.data || [], startDate, endDate) : [],
    isLoading, error, startDate, endDate,
  };
};
