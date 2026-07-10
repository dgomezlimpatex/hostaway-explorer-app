interface TaskScheduleWindow {
  startTime: string;
  endTime: string;
}

export interface CanonicalTaskAssignmentChange {
  taskId: string;
  nextCleanerIds: string[];
  previousCleanerIds: string[];
  nextSchedule?: TaskScheduleWindow;
  previousSchedule?: TaskScheduleWindow;
}

interface CanonicalTaskAssignmentDependencies<TResult> {
  setAssignments: (taskId: string, cleanerIds: string[]) => Promise<TResult>;
  updateSchedule: (taskId: string, startTime: string, endTime: string) => Promise<unknown>;
}

export const executeCanonicalTaskAssignmentChange = async <TResult>(
  change: CanonicalTaskAssignmentChange,
  dependencies: CanonicalTaskAssignmentDependencies<TResult>,
): Promise<TResult> => {
  if (change.nextSchedule && !change.previousSchedule) {
    throw new Error(`La tarea ${change.taskId} no tiene horario anterior para poder revertir el cambio.`);
  }

  let scheduleAttempted = false;
  let assignmentAttempted = false;

  try {
    if (change.nextSchedule) {
      scheduleAttempted = true;
      await dependencies.updateSchedule(
        change.taskId,
        change.nextSchedule.startTime,
        change.nextSchedule.endTime,
      );
    }

    assignmentAttempted = true;
    return await dependencies.setAssignments(change.taskId, change.nextCleanerIds);
  } catch (error) {
    if (assignmentAttempted) {
      try {
        await dependencies.setAssignments(change.taskId, change.previousCleanerIds);
      } catch {
        // Continue with schedule rollback and preserve the original error.
      }
    }

    if (scheduleAttempted && change.previousSchedule) {
      try {
        await dependencies.updateSchedule(
          change.taskId,
          change.previousSchedule.startTime,
          change.previousSchedule.endTime,
        );
      } catch {
        // Preserve the original error after best-effort rollback.
      }
    }

    throw error;
  }
};
