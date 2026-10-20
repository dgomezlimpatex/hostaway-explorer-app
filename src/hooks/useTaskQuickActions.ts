import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { taskStorageService } from '@/services/taskStorage';
import { Task } from '@/types/calendar';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/utils/logger';
import { getMadridToday, shiftCivilDate } from '@/utils/madridCalendar';

const SNAP_MIN = 15;

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const fromMinutes = (mins: number) => {
  const clamped = Math.max(0, Math.min(mins, 24 * 60 - 1));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const snapToQuarter = (mins: number) => Math.round(mins / SNAP_MIN) * SNAP_MIN;

export type ScheduleChangeGuard = (
  task: Task,
  next: { date: string; startTime: string; endTime: string },
) => Promise<boolean>;

/**
 * Quick edit actions for tasks from calendar (resize, reschedule, duplicate, etc.).
 * - `validate` runs the same checks as a drop (overlaps, absences,
 *   availability) before anything is saved or anyone is notified.
 * - All run with optimistic updates.
 * - Background DB writes; rollback on error via invalidation.
 */
export const useTaskQuickActions = (options: { validate?: ScheduleChangeGuard } = {}) => {
  const { validate } = options;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const optimisticPatch = useCallback(
    (taskId: string, patch: Partial<Task>) => {
      queryClient.setQueriesData(
        { predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === 'tasks' },
        (oldData: Task[] | undefined) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.map(t => (t.id === taskId ? { ...t, ...patch } : t));
        }
      );
    },
    [queryClient]
  );

  const invalidateTasks = useCallback(
    (refetch: boolean) => {
      queryClient.invalidateQueries({
        predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === 'tasks',
        refetchType: refetch ? 'active' : 'none',
      });
    },
    [queryClient]
  );

  const findTask = useCallback(
    (taskId: string): Task | undefined => {
      const queries = queryClient.getQueriesData<Task[]>({
        predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === 'tasks',
      });
      for (const [, data] of queries) {
        if (Array.isArray(data)) {
          const found = data.find(t => t.id === taskId);
          if (found) return found;
        }
      }
      return undefined;
    },
    [queryClient]
  );

  /** Resize a task: change endTime keeping startTime, snap to 15min. */
  const resizeTask = useCallback(
    async (taskId: string, newEndTimeRaw: string) => {
      const task = findTask(taskId);
      if (!task) return;

      const startMin = toMinutes(task.startTime);
      const endMin = snapToQuarter(toMinutes(newEndTimeRaw));
      const safeEndMin = Math.max(startMin + SNAP_MIN, endMin);
      const newEndTime = fromMinutes(safeEndMin);
      const newDuration = safeEndMin - startMin;

      if (newEndTime === task.endTime) return;
      if (validate && !(await validate(task, { date: task.date, startTime: task.startTime, endTime: newEndTime }))) return;

      optimisticPatch(taskId, { endTime: newEndTime, duration: newDuration });

      try {
        await taskStorageService.updateTaskSchedule(
          taskId,
          { endTime: newEndTime, duration: newDuration },
          task
        );
        invalidateTasks(false);
      } catch (err: any) {
        logger.error('resizeTask failed:', err);
        invalidateTasks(true);
        toast({
          title: 'No se pudo redimensionar',
          description: err?.message || 'Error guardando la nueva duración.',
          variant: 'destructive',
        });
      }
    },
    [findTask, optimisticPatch, invalidateTasks, toast, validate]
  );

  /** Reschedule keeping the same cleaner: move to new start time and date. */
  const rescheduleTask = useCallback(
    async (taskId: string, newStartTimeRaw: string, newDate?: string) => {
      const task = findTask(taskId);
      if (!task) return;

      const duration =
        task.duration ?? toMinutes(task.endTime) - toMinutes(task.startTime);
      const startMin = snapToQuarter(toMinutes(newStartTimeRaw));
      const endMin = startMin + (duration || 60);
      const newStart = fromMinutes(startMin);
      const newEnd = fromMinutes(endMin);
      const targetDate = newDate || task.date;

      if (
        newStart === task.startTime &&
        newEnd === task.endTime &&
        targetDate === task.date
      ) {
        return;
      }
      if (validate && !(await validate(task, { date: targetDate, startTime: newStart, endTime: newEnd }))) return;

      optimisticPatch(taskId, {
        startTime: newStart,
        endTime: newEnd,
        date: targetDate,
      });

      try {
        await taskStorageService.updateTaskSchedule(
          taskId,
          { startTime: newStart, endTime: newEnd, date: targetDate },
          task
        );
        invalidateTasks(false);
      } catch (err: any) {
        logger.error('rescheduleTask failed:', err);
        invalidateTasks(true);
        toast({
          title: 'No se pudo mover la tarea',
          description: err?.message || 'Error reprogramando la tarea.',
          variant: 'destructive',
        });
      }
    },
    [findTask, optimisticPatch, invalidateTasks, toast, validate]
  );

  /**
   * Quick date shift. previousDay/nextDay/nextWeek are relative to the task's
   * own date (not to the real today), so they behave the same in any view.
   */
  const moveTaskToDate = useCallback(
    async (taskId: string, target: 'today' | 'tomorrow' | 'previousDay' | 'nextDay' | 'nextWeek' | string) => {
      const task = findTask(taskId);
      if (!task) return;

      let newDate: string;
      // Civil dates in Europe/Madrid, independent of the device timezone.
      const today = getMadridToday();
      if (target === 'today') {
        newDate = today;
      } else if (target === 'tomorrow') {
        newDate = shiftCivilDate(today, 1);
      } else if (target === 'previousDay') {
        newDate = shiftCivilDate(task.date || today, -1);
      } else if (target === 'nextDay') {
        newDate = shiftCivilDate(task.date || today, 1);
      } else if (target === 'nextWeek') {
        newDate = shiftCivilDate(task.date || today, 7);
      } else {
        newDate = target;
      }

      if (newDate === task.date) return;
      if (validate && !(await validate(task, { date: newDate, startTime: task.startTime, endTime: task.endTime }))) return;

      optimisticPatch(taskId, { date: newDate });

      try {
        await taskStorageService.updateTaskSchedule(taskId, { date: newDate }, task);
        invalidateTasks(false);
        toast({ title: 'Tarea movida', description: `Nueva fecha: ${newDate}` });
      } catch (err: any) {
        logger.error('moveTaskToDate failed:', err);
        invalidateTasks(true);
        toast({
          title: 'No se pudo mover',
          description: err?.message || 'Error moviendo la tarea.',
          variant: 'destructive',
        });
      }
    },
    [findTask, optimisticPatch, invalidateTasks, toast, validate]
  );

  /** Set duration in minutes (recalculates endTime). */
  const setTaskDuration = useCallback(
    async (taskId: string, durationMinutes: number) => {
      const task = findTask(taskId);
      if (!task) return;

      const startMin = toMinutes(task.startTime);
      const endMin = startMin + durationMinutes;
      const newEnd = fromMinutes(endMin);

      if (newEnd === task.endTime) return;
      if (validate && !(await validate(task, { date: task.date, startTime: task.startTime, endTime: newEnd }))) return;

      optimisticPatch(taskId, { endTime: newEnd, duration: durationMinutes });

      try {
        await taskStorageService.updateTaskSchedule(
          taskId,
          { endTime: newEnd, duration: durationMinutes },
          task
        );
        invalidateTasks(false);
      } catch (err: any) {
        logger.error('setTaskDuration failed:', err);
        invalidateTasks(true);
        toast({
          title: 'No se pudo cambiar la duración',
          description: err?.message || 'Error guardando la duración.',
          variant: 'destructive',
        });
      }
    },
    [findTask, optimisticPatch, invalidateTasks, toast, validate]
  );

  /** Add (or subtract) minutes to the current task duration. */
  const addTaskDuration = useCallback(
    async (taskId: string, deltaMinutes: number) => {
      const task = findTask(taskId);
      if (!task) return;

      const startMin = toMinutes(task.startTime);
      const currentDuration =
        task.duration ?? toMinutes(task.endTime) - startMin;
      const newDuration = Math.max(SNAP_MIN, currentDuration + deltaMinutes);
      const endMin = startMin + newDuration;
      const newEnd = fromMinutes(endMin);

      if (newEnd === task.endTime) return;
      if (validate && !(await validate(task, { date: task.date, startTime: task.startTime, endTime: newEnd }))) return;

      optimisticPatch(taskId, { endTime: newEnd, duration: newDuration });

      try {
        await taskStorageService.updateTaskSchedule(
          taskId,
          { endTime: newEnd, duration: newDuration },
          task
        );
        invalidateTasks(false);
      } catch (err: any) {
        logger.error('addTaskDuration failed:', err);
        invalidateTasks(true);
        toast({
          title: 'No se pudo cambiar la duración',
          description: err?.message || 'Error ajustando la duración.',
          variant: 'destructive',
        });
      }
    },
    [findTask, optimisticPatch, invalidateTasks, toast, validate]
  );

  return {
    resizeTask,
    rescheduleTask,
    moveTaskToDate,
    setTaskDuration,
    addTaskDuration,
  };
};
