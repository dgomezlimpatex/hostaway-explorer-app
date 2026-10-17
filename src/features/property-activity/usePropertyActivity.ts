import { useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSede } from '@/contexts/SedeContext';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { getMadridToday } from '@/utils/madridCalendar';
import { ACTIVITY_SOURCES, activityWindows, type ActivityPeriod, type ActivitySourceId } from './propertyActivityModel';
import { fetchActivitySource, sourceAllowed, type ActivityAccess, type ActivityDb } from './propertyActivitySources';
import { combineActivity } from './propertyActivityState';

export function usePropertyActivity(propertyId: string, period: ActivityPeriod, type: ActivitySourceId | 'all', loadedWindows: number) {
  const { activeSede, isInitialized, loading } = useSede();
  const { hasPermission } = useRolePermissions();
  const access: ActivityAccess = {
    tasks: hasPermission('tasks', 'canView'),
    reports: hasPermission('reports', 'canView'),
    supervision: hasPermission('supervision', 'canView'),
    inventory: hasPermission('inventory', 'canView'),
  };
  const sedeId = activeSede?.id || '';
  const windows = activityWindows(getMadridToday(), period);
  const shown = windows.slice(0, Math.max(1, Math.min(loadedWindows, windows.length)));
  const sources = ACTIVITY_SOURCES.map(source => source.id).filter(id => type === 'all' || id === type);
  const allowed = sources.filter(id => sourceAllowed(id, access));
  const ready = !!sedeId && isInitialized && !loading;
  const plan = shown.flatMap(window => allowed.map(source => ({ window, source })));

  const results = useQueries({
    queries: plan.map(({ window, source }) => ({
      queryKey: ['property-activity', sedeId, propertyId, source, window.from, window.to, access.reports],
      enabled: ready,
      staleTime: 2 * 60 * 1000,
      retry: 1,
      queryFn: ({ signal }: { signal?: AbortSignal }) => fetchActivitySource(supabase as unknown as ActivityDb, source, { propertyId, sedeId, window, access, signal }),
    })),
  });

  const state = combineActivity({
    windows: shown,
    sources,
    restricted: sources.filter(id => !allowed.includes(id)),
    results: plan.map((item, index) => ({ ...item, status: ready ? results[index].status : 'pending', data: results[index].data, error: results[index].error })),
  });
  return {
    ...state,
    ready,
    canLoadMore: shown.length < windows.length,
    totalWindows: windows.length,
    periodStart: windows[windows.length - 1]?.from,
    reportsVisible: access.reports,
    retry: () => { results.forEach(result => { if (result.isError) void result.refetch(); }); },
  };
}
