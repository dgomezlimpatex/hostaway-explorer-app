import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSede } from '@/contexts/SedeContext';
import { useRecurringTaskInstances } from '@/hooks/useRecurringTaskInstances';
import { useAllWorkerMaintenanceCleanings } from '@/hooks/useWorkerMaintenanceCleanings';
import { taskStorageService } from '@/services/storage/taskStorage';
import { fetchPlanningWeekTasks, planningWeekDates } from '@/utils/planningCalendarWeeklyHours';

export function usePlanningCalendarWeek(date: string) {
  const { activeSede } = useSede();
  const range = useMemo(() => planningWeekDates(date), [date]);
  const query = useQuery({
    // Shares the planner prefix so every saved assignment refreshes the weekly totals.
    queryKey:['cleaning-planning-tasks','week',activeSede?.id,range.startDate,range.endDate],
    queryFn:() => fetchPlanningWeekTasks(range.startDate, range.endDate,
      day => taskStorageService.getTasks({dateFrom:day,dateTo:day,sedeId:activeSede?.id})),
    enabled:Boolean(activeSede?.id && range.startDate),
    staleTime:0,
    refetchInterval:60000,
  });
  const recurring = useRecurringTaskInstances({dateFrom:range.startDate,dateTo:range.endDate});
  const maintenance = useAllWorkerMaintenanceCleanings();
  const data = useMemo(
    () => query.data ? [...query.data, ...recurring.virtualTasks] : undefined,
    [query.data, recurring.virtualTasks],
  );
  return {
    ...range,
    data,
    maintenance:maintenance.data ?? [],
    isPending:query.isPending || recurring.isLoading || maintenance.isPending,
    isError:query.isError || recurring.isError || maintenance.isError,
  };
}
