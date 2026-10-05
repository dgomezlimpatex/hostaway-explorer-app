import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSede } from '@/contexts/SedeContext';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { formatMadridDate } from '@/utils/date';
import { buildAttention } from './domain';
import { readAttentionDay, reviewAlert } from './storage';

export function useAttention() {
  const {activeSede, isInitialized, loading} = useSede();
  const {isAdminOrManager} = useRolePermissions();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const sedeId = activeSede?.id || '';
  const allowed = isAdminOrManager();
  const enabled = allowed && isInitialized && !loading && !!sedeId;
  const date = formatMadridDate(now);
  const query = useQuery({
    queryKey: ['operational-attention', sedeId, date],
    queryFn: () => readAttentionDay(sedeId, date), enabled,
    refetchOnWindowFocus: true, refetchInterval: 60_000, refetchIntervalInBackground: false,
    staleTime: 20_000, retry: 1,
  });
  useEffect(() => {
    if (!enabled) return;
    const update = () => {if (!document.hidden) setNow(new Date());};
    const interval = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      const root = String(event.query.queryKey[0]).toLowerCase();
      if (event.type === 'updated' && (event.action.type === 'success' || event.action.type === 'invalidate') &&
        (root === 'tasks' || root.includes('taskreport') || root.includes('task-report'))) {
        void queryClient.invalidateQueries({queryKey: ['operational-attention', sedeId, date]});
      }
    });
    return () => {window.clearInterval(interval); document.removeEventListener('visibilitychange', update); window.removeEventListener('focus', update); unsubscribe();};
  }, [enabled, queryClient, sedeId, date]);
  const result = useMemo(() => query.data ? buildAttention(
    query.data.tasks, query.data.reports, sedeId, now, new Set(query.data.reviews.map(review => review.alert_key)),
  ) : {groups: [], issues: []}, [query.data, sedeId, now]);
  const review = useMutation({
    mutationFn: reviewAlert,
    onSuccess: async (_result, alert) => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['operational-attention', alert.sedeId]}),
        queryClient.invalidateQueries({queryKey: ['attention-history', alert.sedeId]}),
      ]);
    },
  });
  return {...result, query, review, sedeId, date, allowed, enabled};
}
