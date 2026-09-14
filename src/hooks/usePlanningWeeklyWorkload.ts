import { useQuery } from '@tanstack/react-query';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import { useCleaners } from './useCleaners';
import { taskStorageService } from '@/services/storage/taskStorage';
import { Cleaner } from '@/types/calendar';
import { buildPlanningWeeklyWorkload, PlanningWeeklyWorkload } from '@/utils/planningWeeklyWorkload';

interface UsePlanningWeeklyWorkloadOptions {
  date: Date;
  sedeId?: string;
}

const toDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

export const usePlanningWeeklyWorkload = ({ date, sedeId }: UsePlanningWeeklyWorkloadOptions) => {
  const { cleaners = [], isLoading: cleanersLoading } = useCleaners();
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  const startDate = toDateKey(weekStart);
  const endDate = toDateKey(weekEnd);

  const query = useQuery({
    queryKey: [
      'planning-weekly-workload',
      startDate,
      endDate,
      sedeId || 'all',
      cleaners.map((cleaner) => `${cleaner.id}:${cleaner.contractHoursPerWeek ?? 0}`).join('|'),
    ],
    queryFn: async () => {
      const tasks = await taskStorageService.getTasks({
        dateFrom: startDate,
        dateTo: endDate,
        sedeId,
      });

      return buildPlanningWeeklyWorkload(tasks, cleaners as Cleaner[]);
    },
    enabled: Boolean(startDate && endDate) && !cleanersLoading,
    staleTime: 30000,
  });

  return {
    ...query,
    data: query.data || [],
    startDate,
    endDate,
  } as typeof query & { data: PlanningWeeklyWorkload[]; startDate: string; endDate: string };
};
