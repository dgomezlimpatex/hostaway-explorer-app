import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkloadCalculation } from './useWorkloadCalculation';
import { WorkloadSummary } from '@/types/workload';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { debounce } from 'lodash';

export const WORKLOAD_REFRESH_DELAY_MS = 1000;

export const useCalendarWorkload = (viewDate?: Date) => {
  const queryClient = useQueryClient();
  const referenceDate = viewDate || new Date();
  const weekStart = format(startOfWeek(referenceDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(referenceDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  
  const { data: summaries = [], isLoading } = useWorkloadCalculation({
    startDate: weekStart,
    endDate: weekEnd,
  });

  useEffect(() => {
    // Realtime sends one event per changed row: a batch of task updates would
    // recalculate the whole week once per row. Refresh once after a short pause.
    const refreshWorkload = debounce(() => {
      void queryClient.invalidateQueries({ queryKey: ['workload', weekStart, weekEnd] });
    }, WORKLOAD_REFRESH_DELAY_MS);

    const channel = supabase
      .channel(`calendar-workload-${weekStart}-${weekEnd}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, refreshWorkload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignments' }, refreshWorkload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_hour_adjustments' }, refreshWorkload)
      .subscribe();

    return () => {
      refreshWorkload.cancel();
      void supabase.removeChannel(channel);
    };
  }, [queryClient, weekEnd, weekStart]);

  const workloadMap = useMemo(() => {
    const map: Record<string, WorkloadSummary> = {};
    for (const s of summaries) {
      map[s.cleanerId] = s;
    }
    return map;
  }, [summaries]);

  return { workloadMap, isLoading };
};
