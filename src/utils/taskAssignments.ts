import { Task } from "@/types/calendar";

interface CleanerTaskAccessInput {
  visibleCanonicalCleanerIds: string[];
  canonicalAssignmentCount: number;
  legacyCleanerId?: string | null;
}

export const parseTaskAssignmentCounts = (
  data: unknown,
  requestedTaskIds: string[],
): Map<string, number> => {
  if (!Array.isArray(data)) {
    throw new Error('Invalid task assignment count response');
  }

  const requestedIds = new Set(requestedTaskIds);
  const counts = new Map<string, number>();

  data.forEach((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Invalid task assignment count row');
    }

    const row = value as Record<string, unknown>;
    const taskId = row.task_id;
    const assignmentCount = row.assignment_count;

    if (
      typeof taskId !== 'string'
      || taskId.length === 0
      || !requestedIds.has(taskId)
      || counts.has(taskId)
      || !Number.isSafeInteger(assignmentCount)
      || (assignmentCount as number) < 1
    ) {
      throw new Error('Invalid task assignment count row');
    }

    counts.set(taskId, assignmentCount as number);
  });

  return counts;
};

export const canCleanerAccessTaskByAssignments = (
  {
    visibleCanonicalCleanerIds,
    canonicalAssignmentCount,
    legacyCleanerId,
  }: CleanerTaskAccessInput,
  cleanerId: string,
): boolean => canonicalAssignmentCount > 0
  ? visibleCanonicalCleanerIds.includes(cleanerId)
  : legacyCleanerId === cleanerId;

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

export const buildTaskAssignmentsMap = (
  tasks: Array<Pick<Task, "id" | "cleanerId" | "assignments">>
): Record<string, string[]> => {
  const map: Record<string, string[]> = {};

  tasks.forEach((task) => {
    const cleanerIds = getTaskAssignedCleanerIds(task);
    if (cleanerIds.length > 0) map[task.id] = cleanerIds;
  });

  return map;
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
