import { useMemo } from 'react';
import { useWorkloadCalculation } from './useWorkloadCalculation';
import { WorkloadSummary } from '@/types/workload';
import { format, startOfWeek, endOfWeek } from 'date-fns';

export const useCalendarWorkload = (viewDate?: Date) => {
  const referenceDate = viewDate || new Date();
  const weekStart = format(startOfWeek(referenceDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(referenceDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  
  const { data: summaries = [], isLoading } = useWorkloadCalculation({
    startDate: weekStart,
    endDate: weekEnd,
  });

  const workloadMap = useMemo(() => {
    const map: Record<string, WorkloadSummary> = {};
    for (const s of summaries) {
      map[s.cleanerId] = s;
    }
    return map;
  }, [summaries]);

  return { workloadMap, isLoading };
};
