import { Task } from "@/types/calendar";

export const getTaskAssignedCleanerIds = (
  task: Pick<Task, "cleanerId" | "assignments">
): string[] => {
  const assignmentIds = (task.assignments || [])
    .map((assignment) => assignment.cleaner_id)
    .filter(Boolean);

  const ids = assignmentIds.length > 0
    ? assignmentIds
    : ([task.cleanerId].filter(Boolean) as string[]);

  return Array.from(new Set(ids));
};

export const countTasksByAssignedCleaner = (
  tasks: Array<Pick<Task, "cleanerId" | "assignments">>
): Map<string, number> => {
  const counts = new Map<string, number>();

  tasks.forEach((task) => {
    getTaskAssignedCleanerIds(task).forEach((cleanerId) => {
      counts.set(cleanerId, (counts.get(cleanerId) || 0) + 1);
    });
  });

  return counts;
};

export const isTaskAssignedToCleaner = (
  task: Task,
  cleanerId?: string | null,
  cleanerName?: string | null
) => {
  if (!cleanerId && !cleanerName) return false;

  if (cleanerId && getTaskAssignedCleanerIds(task).includes(cleanerId)) {
    return true;
  }

  if (!cleanerName || !task.cleaner) return false;

  const normalizedCleanerName = cleanerName.trim().toLocaleUpperCase("es-ES");
  return task.cleaner
    .split(",")
    .map((name) => name.trim().toLocaleUpperCase("es-ES"))
    .includes(normalizedCleanerName);
};
