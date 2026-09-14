import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkloadCalculation } from './useWorkloadCalculation';
import { WorkloadSummary } from '@/types/workload';
import { format, startOfWeek, endOfWeek } from 'date-fns';

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
    const channel = supabase
      .channel(`calendar-workload-${weekStart}-${weekEnd}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['workload', weekStart, weekEnd] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignments' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['workload', weekStart, weekEnd] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_hour_adjustments' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['workload', weekStart, weekEnd] });
      })
      .subscribe();

    return () => {
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
