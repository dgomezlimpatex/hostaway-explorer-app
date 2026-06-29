import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, endOfWeek, format, startOfWeek } from 'date-fns';
import { taskStorageService } from '@/services/taskStorage';
import { useCleaners } from '@/hooks/useCleaners';
import { useWorkerContracts } from '@/hooks/useWorkerContracts';
import { useSede } from '@/contexts/SedeContext';
import { buildCleaningPlanningModel, DEFAULT_DAILY_CAPACITY_MINUTES } from '@/utils/cleaningPlanning';
import { WorkerContract } from '@/types/calendar';
import { CleanerCapacityMap, CleaningPlanningModel, PlanningRangePreset } from '@/types/cleaningPlanning';
import { formatMadridDate } from '@/utils/date';

interface UseCleaningPlanningOptions {
  date: Date;
  preset: PlanningRangePreset;
}

const getPlanningRange = (date: Date, preset: PlanningRangePreset) => {
  if (preset === 'tomorrow') {
    const tomorrow = addDays(date, 1);
    const dateStr = formatMadridDate(tomorrow);
    return { startDate: dateStr, endDate: dateStr };
  }

  if (preset === 'week') {
    return {
      startDate: format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      endDate: format(endOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    };
  }

  const dateStr = formatMadridDate(date);
  return { startDate: dateStr, endDate: dateStr };
};

const buildCapacityMap = (contracts: WorkerContract[] = [], rangeDays: number): CleanerCapacityMap => {
  const capacityByCleaner: CleanerCapacityMap = {};

  contracts
    .filter((contract) => contract.isActive)
    .forEach((contract) => {
      const cleanerId = contract.cleanerId;
      if (!cleanerId) return;

      const weeklyHours = Number(contract.contractHoursPerWeek ?? 40);
      const dailyMinutes = Number.isFinite(weeklyHours)
        ? Math.max(0, Math.round((weeklyHours * 60) / 5))
        : DEFAULT_DAILY_CAPACITY_MINUTES;

      capacityByCleaner[cleanerId] = dailyMinutes * rangeDays;
    });

  return capacityByCleaner;
};

export const useCleaningPlanning = ({ date, preset }: UseCleaningPlanningOptions) => {
  const { activeSede, isInitialized, loading: sedeLoading } = useSede();
  const { cleaners, isLoading: cleanersLoading } = useCleaners();
  const { data: contracts = [], isLoading: contractsLoading } = useWorkerContracts();

  const range = useMemo(() => getPlanningRange(date, preset), [date, preset]);
  const rangeDays = useMemo(() => {
    const start = new Date(`${range.startDate}T00:00:00`);
    const end = new Date(`${range.endDate}T00:00:00`);
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  }, [range.endDate, range.startDate]);

  const tasksQuery = useQuery({
    queryKey: ['cleaning-planning-tasks', range.startDate, range.endDate, activeSede?.id || 'pending-sede'],
    queryFn: () => taskStorageService.getTasks({
      sedeId: activeSede?.id,
      dateFrom: range.startDate,
      dateTo: range.endDate,
    }),
    enabled: isInitialized && !sedeLoading && Boolean(activeSede?.id),
    staleTime: 15_000,
  });

  const capacityByCleaner = useMemo(
    () => buildCapacityMap(contracts, rangeDays),
    [contracts, rangeDays],
  );

  const planning = useMemo<CleaningPlanningModel>(() => buildCleaningPlanningModel(
    tasksQuery.data || [],
    cleaners,
    capacityByCleaner,
    range.startDate,
    range.endDate,
  ), [capacityByCleaner, cleaners, range.endDate, range.startDate, tasksQuery.data]);

  return {
    planning,
    range,
    isLoading: tasksQuery.isLoading || cleanersLoading || contractsLoading || sedeLoading,
    isError: tasksQuery.isError,
    error: tasksQuery.error,
    refetch: tasksQuery.refetch,
  };
};
