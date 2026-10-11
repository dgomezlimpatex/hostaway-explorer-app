import { Task } from '@/types/calendar';

export interface BatchCreationResult {
  created: number;
  failed: Array<Omit<Task, 'id'>>;
}

/**
 * Creates the tasks one by one and keeps going after a failure, so the user
 * learns exactly which ones are missing instead of a generic error after a
 * partial creation.
 */
export const createTasksOneByOne = async (
  tasksData: Array<Omit<Task, 'id'>>,
  createTask: (taskData: Omit<Task, 'id'>) => Promise<unknown>,
): Promise<BatchCreationResult> => {
  const failed: Array<Omit<Task, 'id'>> = [];
  let created = 0;
  for (const taskData of tasksData) {
    try {
      await createTask(taskData);
      created += 1;
    } catch {
      failed.push(taskData);
    }
  }
  return { created, failed };
};

/** Toast text for a batch where some tasks could not be created. */
export const describeBatchFailure = ({ created, failed }: BatchCreationResult) => {
  const total = created + failed.length;
  const names = failed.map((task) => `${task.property} (${task.date} ${task.startTime})`);
  const shown = names.slice(0, 5).join(', ') + (names.length > 5 ? ` y ${names.length - 5} más` : '');
  return created === 0
    ? `No se pudo crear ninguna de las ${total} tareas.`
    : `Se crearon ${created} de ${total} tareas. Faltan: ${shown}.`;
};
