import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/calendar';
import { taskStorageService } from '@/services/taskStorage';

type MaterializeOverrides = Partial<Pick<Task, 'cleaner' | 'cleanerId' | 'startTime' | 'endTime' | 'status'>>;

export const markRecurringTaskInstanceHandled = async (
  recurringTaskId: string,
  executionDate: string,
  generatedTaskId?: string | null
) => {
  const { error } = await supabase.from('recurring_task_executions').insert({
    recurring_task_id: recurringTaskId,
    execution_date: executionDate,
    generated_task_id: generatedTaskId || null,
    success: true,
  });

  if (error) {
    console.error('Error marking recurring task instance as handled:', error);
    throw error;
  }
};

export const materializeRecurringTaskInstance = async (
  task: Task,
  overrides: MaterializeOverrides = {}
): Promise<Task> => {
  const recurringTaskId = task.recurringTaskId;
  if (!recurringTaskId) {
    throw new Error('La tarea recurrente no tiene identificador de plantilla.');
  }

  const {
    id,
    created_at,
    updated_at,
    isRecurringInstance,
    recurringTaskId: _recurringTaskId,
    originalTaskId,
    cleaner,
    cleanerId,
    ...taskBase
  } = task as Task & Record<string, unknown>;

  const assignedCleaner = overrides.cleaner;
  const assignedCleanerId = overrides.cleanerId;

  const newTaskData = {
    ...taskBase,
    startTime: overrides.startTime || task.startTime,
    endTime: overrides.endTime || task.endTime,
    status: overrides.status || task.status || 'pending',
    cleaner: undefined,
    cleanerId: undefined,
  } as Omit<Task, 'id'>;

  delete (newTaskData as Record<string, unknown>).isRecurringInstance;
  delete (newTaskData as Record<string, unknown>).recurringTaskId;
  delete (newTaskData as Record<string, unknown>).originalTaskId;

  const createdTask = await taskStorageService.createTask(newTaskData);

  const finalTask = assignedCleaner && assignedCleanerId
    ? await taskStorageService.assignTask(createdTask.id, assignedCleaner, assignedCleanerId)
    : createdTask;

  await markRecurringTaskInstanceHandled(recurringTaskId, task.date, createdTask.id);

  return finalTask;
};
