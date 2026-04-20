import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { taskStorageService } from '@/services/taskStorage';
import { Task } from '@/types/calendar';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/utils/logger';

export type FieldSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseInlineFieldSaveOptions {
  taskId: string;
  /**
   * Trigger schedule-change email + extra side-effects when date/start/end changes.
   * Defaults to true.
   */
  notifyScheduleChange?: boolean;
}

/**
 * Hook for inline autosave of task fields.
 * - Optimistic update across all task caches
 * - Background DB write (non-blocking UI)
 * - Per-field status indicator (saving/saved/error)
 */
export const useInlineFieldSave = ({ taskId, notifyScheduleChange = true }: UseInlineFieldSaveOptions) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusByField, setStatusByField] = useState<Record<string, FieldSaveStatus>>({});
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const setFieldStatus = useCallback((field: string, status: FieldSaveStatus) => {
    setStatusByField(prev => ({ ...prev, [field]: status }));

    // Auto-clear "saved" after 1.5s
    if (savedTimers.current[field]) {
      clearTimeout(savedTimers.current[field]);
      delete savedTimers.current[field];
    }
    if (status === 'saved') {
      savedTimers.current[field] = setTimeout(() => {
        setStatusByField(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }, 1500);
    }
  }, []);

  /**
   * Save a partial update for the task.
   * @param updates - Fields to update (Task shape)
   * @param fieldKey - Logical field key for status tracking (e.g. 'startTime' or 'schedule')
   */
  const saveField = useCallback(
    async (updates: Partial<Task>, fieldKey: string) => {
      if (!taskId) return;

      setFieldStatus(fieldKey, 'saving');

      // Snapshot previous data per query for rollback
      const snapshots: Array<{ key: unknown; data: Task[] | undefined }> = [];

      // Optimistic update across all 'tasks' queries
      queryClient.setQueriesData(
        { predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === 'tasks' },
        (oldData: Task[] | undefined) => {
          snapshots.push({ key: oldData, data: oldData ? [...oldData] : undefined });
          if (!Array.isArray(oldData)) return oldData;
          return oldData.map(t => (t.id === taskId ? { ...t, ...updates } : t));
        }
      );

      try {
        // Detect schedule change
        const isScheduleChange =
          notifyScheduleChange &&
          ('date' in updates || 'startTime' in updates || 'endTime' in updates);

        if (isScheduleChange) {
          // Find current task in cache
          let currentTask: Task | undefined;
          const queries = queryClient.getQueriesData<Task[]>({
            predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === 'tasks',
          });
          for (const [, data] of queries) {
            if (Array.isArray(data)) {
              const found = data.find(t => t.id === taskId);
              if (found) {
                currentTask = found;
                break;
              }
            }
          }
          await taskStorageService.updateTaskSchedule(taskId, updates, currentTask);
        } else {
          await taskStorageService.updateTask(taskId, updates);
        }

        setFieldStatus(fieldKey, 'saved');

        // Silent invalidation (no refetch storm)
        queryClient.invalidateQueries({
          predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === 'tasks',
          refetchType: 'none',
        });
      } catch (err: any) {
        logger.error('Inline save failed:', err);
        setFieldStatus(fieldKey, 'error');

        // Rollback by forcing a refetch
        queryClient.invalidateQueries({
          predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === 'tasks',
        });

        toast({
          title: 'No se pudo guardar',
          description: err?.message || 'Error guardando el cambio.',
          variant: 'destructive',
        });
      }
    },
    [taskId, queryClient, toast, setFieldStatus, notifyScheduleChange]
  );

  return { saveField, statusByField };
};
