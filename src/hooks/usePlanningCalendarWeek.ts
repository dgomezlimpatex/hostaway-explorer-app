import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSede } from '@/contexts/SedeContext';
import { taskStorageService } from '@/services/storage/taskStorage';
import { planningWeekDates } from '@/utils/planningCalendarWeeklyHours';

export function usePlanningCalendarWeek(date: string) {
  const { activeSede } = useSede();
  const range = useMemo(() => planningWeekDates(date), [date]);
  const query = useQuery({
    queryKey:['planning-calendar-week',activeSede?.id,range.startDate,range.endDate],
    queryFn:() => taskStorageService.getTasks({dateFrom:range.startDate,dateTo:range.endDate,sedeId:activeSede?.id}),
    enabled:Boolean(activeSede?.id && range.startDate),
    staleTime:30000,
  });
  return {...query,...range};
}
