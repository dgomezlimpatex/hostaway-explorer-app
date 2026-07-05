import type { CleaningPlanningTask } from '../../types/cleaningPlanning';

export const buildPlanningBundleId = (date: string, propertyGroupId: string): string => `${date}:${propertyGroupId}`;

export const getPlanningBundleTaskSortKey = (task: CleaningPlanningTask): string => (
  `${task.date} ${task.startTime || ''} ${task.propertyCode || task.property || task.id}`
);
