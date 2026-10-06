import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useSede } from '@/contexts/SedeContext';
import { supabase } from '@/integrations/supabase/client';
import { taskStorageService } from '@/services/taskStorage';
import { taskReportsStorageService } from '@/services/storage/taskReportsStorage';
import { getTaskDateRange } from '@/utils/taskQueryRange';
import { isTaskAssignedToCleaner } from '@/utils/taskAssignments';
import { formatMadridDate } from '@/utils/date';
import type { Cleaner, Task } from '@/types/calendar';
import type { TaskChecklistTemplate, TaskReport } from '@/types/taskReports';
import { readCleanerCache, readWithCleanerCache } from './offlineStore';
import { useCleanerOfflineStatus } from './CleanerOfflineProvider';

export function useCleanerCachedQuery<T>(key: QueryKey, cacheKey: string, loader: () => Promise<T>, enabled: boolean) {
  const client = useQueryClient();
  const stableKey = JSON.stringify(key);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const queryKey = JSON.parse(stableKey) as QueryKey;
    void readCleanerCache<T>(cacheKey).then(cached => {
      if (!cancelled && cached && client.getQueryData(queryKey) === undefined) {
        client.setQueryData(queryKey, cached.data, { updatedAt: cached.savedAt });
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [cacheKey, enabled, client, stableKey]);
  return useQuery({
    queryKey: key, queryFn: () => readWithCleanerCache(cacheKey, loader), enabled,
    networkMode: 'always', staleTime: 30_000, gcTime: 30 * 60_000,
    retry: false, refetchOnWindowFocus: true, refetchOnReconnect: true,
  });
}

export function useCleanerIdentity() {
  const { user } = useAuth();
  const { activeSede, isInitialized, loading } = useSede();
  const ownerId = user?.id || '';
  const sedeId = activeSede?.id || '';
  const query = useCleanerCachedQuery<Cleaner | null>(
    ['cleaner-self', ownerId, sedeId], `${ownerId}:${sedeId}:identity`, async () => {
      const { data, error } = await supabase.from('cleaners').select('id,name,email,user_id,is_active')
        .eq('user_id', ownerId).eq('sede_id', sedeId).maybeSingle();
      if (error) throw error;
      return data ? { id: data.id, name: data.name, email: data.email, user_id: data.user_id, isActive: data.is_active } as Cleaner : null;
    }, Boolean(ownerId && sedeId && isInitialized && !loading),
  );
  return { ...query, ownerId, sedeId };
}

export interface CleanerTaskBundle {
  report: TaskReport | null;
  templates: TaskChecklistTemplate[];
  assignedTemplateId?: string;
  property: { notas?: string; numero_camas?: number; numero_banos?: number; numero_sabanas?: number; numero_toallas_grandes?: number; numero_toallas_pequenas?: number } | null;
}

export const cleanerBundleKey = (ownerId: string, sedeId: string, taskId: string) => `${ownerId}:${sedeId}:task:${taskId}`;
const templateRequests = new Map<string, Promise<TaskChecklistTemplate[]>>();
async function loadTemplates(ownerId: string, sedeId: string): Promise<TaskChecklistTemplate[]> {
  const key = `${ownerId}:${sedeId}:templates`;
  const cached = await readCleanerCache<TaskChecklistTemplate[]>(key).catch(() => undefined);
  if (cached && Date.now() - cached.savedAt < 5 * 60_000) return cached.data;
  if (!templateRequests.has(key)) templateRequests.set(key, readWithCleanerCache(key, () => taskReportsStorageService.getChecklistTemplates()).finally(() => templateRequests.delete(key)));
  return templateRequests.get(key)!;
}

export async function loadCleanerBundle(ownerId: string, sedeId: string, task: Task, cleanerId: string): Promise<CleanerTaskBundle> {
  const taskId = task.originalTaskId || task.id.split('_assignment_')[0];
  const [report, templates, assignment, propertyResult] = await Promise.all([
    supabase.from('task_reports').select('*').eq('task_id', taskId).eq('cleaner_id', cleanerId).maybeSingle(),
    loadTemplates(ownerId, sedeId),
    task.propertyId ? supabase.from('property_checklist_assignments').select('checklist_template_id').eq('property_id', task.propertyId).eq('is_active', true).maybeSingle() : Promise.resolve({ data: null, error: null }),
    task.propertyId ? supabase.from('properties').select('notas,numero_camas,numero_banos,numero_sabanas,numero_toallas_grandes,numero_toallas_pequenas')
      .eq('id', task.propertyId).eq('sede_id', sedeId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (report.error) throw report.error;
  if (assignment.error) throw assignment.error;
  if (propertyResult.error) throw propertyResult.error;
  return { report: report.data as unknown as TaskReport | null, templates, assignedTemplateId: assignment.data?.checklist_template_id, property: propertyResult.data };
}

export function useCleanerTasks(currentDate: Date) {
  const identity = useCleanerIdentity();
  const offline = useCleanerOfflineStatus();
  const client = useQueryClient();
  const cleanerId = identity.data?.id;
  const [prepared, setPrepared] = useState(false);
  const range = getTaskDateRange(currentDate, 'week');
  const nextMonday = new Date(`${range.dateTo}T12:00:00Z`);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 1);
  range.dateTo = formatMadridDate(nextMonday);
  const query = useCleanerCachedQuery<Task[]>(
    ['cleaner-tasks', identity.ownerId, identity.sedeId, range.dateFrom, range.dateTo],
    `${identity.ownerId}:${identity.sedeId}:tasks:${range.dateFrom}:${range.dateTo}`,
    async () => {
      const tasks = await taskStorageService.getTasks({
        cleanerId: identity.data!.id, userRole: 'cleaner', sedeId: identity.sedeId,
        dateFrom: range.dateFrom, dateTo: range.dateTo,
      });
      return tasks.filter(task => isTaskAssignedToCleaner(task, identity.data!.id, identity.data!.name));
    }, Boolean(identity.data?.id && identity.data.isActive !== false),
  );
  useEffect(() => {
    setPrepared(false);
    if (!cleanerId || !query.data) return;
    let cancelled = false;
    const tasks = query.data.filter(task => !task.id.startsWith('recurring_'));
    // Two workers prepare the week without opening a report or starting a task.
    let next = 0;
    const warm = async () => {
      while (!cancelled && next < tasks.length) {
        const task = tasks[next++];
        const key = cleanerBundleKey(identity.ownerId, identity.sedeId, task.originalTaskId || task.id.split('_assignment_')[0]);
        if (navigator.onLine) await client.prefetchQuery({
            queryKey: ['cleaner-bundle', key], staleTime: 60_000,
            queryFn: () => readWithCleanerCache(key, () => loadCleanerBundle(identity.ownerId, identity.sedeId, task, cleanerId)),
          });
      }
    };
    void Promise.all([warm(), warm()]).then(async () => {
      const downloaded = await Promise.all(tasks.map(task => readCleanerCache(cleanerBundleKey(identity.ownerId, identity.sedeId, task.originalTaskId || task.id.split('_assignment_')[0])).catch(() => undefined)));
      if (!cancelled) setPrepared(downloaded.every(Boolean));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [query.data, identity.ownerId, identity.sedeId, cleanerId, client]);
  const tasks = useMemo(() => {
    const drafts = new Map((offline?.drafts || []).filter(draft => draft.sedeId === identity.sedeId).map(draft => [draft.report.task_id, draft]));
    return (query.data || []).map(task => {
      const draft = drafts.get(task.originalTaskId || task.id);
      if (!draft || draft.revision === 0) return task;
      const status: Task['status'] = draft.report.overall_status === 'completed' || task.status === 'completed' ? 'completed' : 'in-progress';
      return { ...task, status, additionalTasks: (task.additionalTasks || []).map(item => draft.subtasks[item.id] ||
        (Date.parse(task.updated_at || '') > Date.parse(draft.report.updated_at) ? item : draft.task.additionalTasks?.find(saved => saved.id === item.id)) || item) };
    });
  }, [query.data, offline?.drafts, identity.sedeId]);
  return {
    tasks, cleaner: identity.data, prepared,
    isLoading: identity.isLoading || query.isLoading,
    error: identity.error || query.error || (identity.data === null ? new Error('No se encuentra tu ficha de trabajadora.') : null),
    hasData: query.data !== undefined,
    refetch: query.refetch,
  };
}
