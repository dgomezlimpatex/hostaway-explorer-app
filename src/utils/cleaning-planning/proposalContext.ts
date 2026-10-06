import type { CleaningPlanningFilters, CleaningPlanningTask, EffectiveWorkerAvailability } from '@/types/cleaningPlanning';

export const buildProposalContextKey = ({ activeSedeId, cleanerIds, availability, filters, range, tasks }: {
  activeSedeId?: string;
  cleanerIds: string[];
  availability: EffectiveWorkerAvailability[];
  filters: CleaningPlanningFilters;
  range: { startDate: string; endDate: string };
  tasks: CleaningPlanningTask[];
}): string => JSON.stringify({
  activeSedeId: activeSedeId || 'sin-sede',
  cleanerIds: [...cleanerIds].sort(),
  // Assigned load is already represented by tasks. Keep the actual availability
  // rules here so a saved adjustment does not look like a changed work schedule.
  availability: availability.map(item => JSON.stringify({
    cleanerId: item.cleanerId, date: item.date, isAvailable: item.isAvailable,
    source: item.source, availableWindows: item.availableWindows,
    blockedWindows: item.blockedWindows.filter(window => window.kind !== 'assigned_task'),
  })).sort(),
  filters, range,
  tasks: tasks.map(task => ({ id: task.id, value: JSON.stringify([
    task.date, task.startTime, task.endTime, task.durationMinutes, task.cleanerId,
    (task.assignments || []).map(assignment => assignment.cleaner_id).sort(),
    task.detectedBuilding?.propertyGroupId,
  ]) })).sort((a, b) => a.id.localeCompare(b.id)),
});

/** Acknowledge only refreshed tasks explicitly saved in this board. */
export const acceptedSavedTaskChanges = (previous: string, current: string, taskIds: string[]): string[] => {
  if (previous === current || !taskIds.length) return [];
  try {
    const before = JSON.parse(previous);
    const after = JSON.parse(current);
    const changed = [...new Set(taskIds)].filter(id => {
      const oldTasks = before.tasks.filter((task: { id: string }) => task.id === id);
      const newTasks = after.tasks.filter((task: { id: string }) => task.id === id);
      return oldTasks.length && newTasks.length && JSON.stringify(oldTasks) !== JSON.stringify(newTasks);
    });
    if (!changed.length) return [];
    before.tasks = before.tasks.filter((task: { id: string }) => !changed.includes(task.id));
    after.tasks = after.tasks.filter((task: { id: string }) => !changed.includes(task.id));
    return JSON.stringify(before) === JSON.stringify(after) ? changed : [];
  } catch { return []; }
};

/** Single-task compatibility; concurrent edits still invalidate the draft. */
export const canAcceptSavedTaskContext = (previous: string, current: string, taskId: string): boolean =>
  acceptedSavedTaskChanges(previous, current, [taskId]).length > 0;
