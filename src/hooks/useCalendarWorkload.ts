import { useMemo } from 'react';
import { useCurrentWeekWorkload } from './useWorkloadCalculation';
import { WorkloadSummary } from '@/types/workload';

export const useCalendarWorkload = () => {
  const { data: summaries = [], isLoading } = useCurrentWeekWorkload();

  const workloadMap = useMemo(() => {
    const map: Record<string, WorkloadSummary> = {};
    for (const s of summaries) {
      map[s.cleanerId] = s;
    }
    return map;
  }, [summaries]);

  return { workloadMap, isLoading };
};
