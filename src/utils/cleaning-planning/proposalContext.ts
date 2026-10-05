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

/** Accept only the task explicitly saved here; concurrent changes stay stale. */
export const canAcceptSavedTaskContext = (previous: string, current: string, taskId: string): boolean => {
  if (previous === current) return false; // Wait for the refreshed task.
  try {
    const before = JSON.parse(previous);
    const after = JSON.parse(current);
    const oldTask = before.tasks.find((task: { id: string }) => task.id === taskId);
    const newTask = after.tasks.find((task: { id: string }) => task.id === taskId);
    if (!oldTask || !newTask || oldTask.value === newTask.value) return false;
    before.tasks = before.tasks.filter((task: { id: string }) => task.id !== taskId);
    after.tasks = after.tasks.filter((task: { id: string }) => task.id !== taskId);
    return JSON.stringify(before) === JSON.stringify(after);
  } catch { return false; }
};
