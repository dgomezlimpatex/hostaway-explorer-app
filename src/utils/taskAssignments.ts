import { Task } from "@/types/calendar";

export const isTaskAssignedToCleaner = (
  task: Task,
  cleanerId?: string | null,
  cleanerName?: string | null
) => {
  if (!cleanerId && !cleanerName) return false;

  if (cleanerId && task.cleanerId === cleanerId) return true;

  const assignments = (task as any).assignments;
  if (
    cleanerId &&
    Array.isArray(assignments) &&
    assignments.some((assignment: any) => assignment.cleaner_id === cleanerId)
  ) {
    return true;
  }

  if (!cleanerName || !task.cleaner) return false;

  const normalizedCleanerName = cleanerName.trim().toLocaleUpperCase("es-ES");
  return task.cleaner
    .split(",")
    .map((name) => name.trim().toLocaleUpperCase("es-ES"))
    .includes(normalizedCleanerName);
};
