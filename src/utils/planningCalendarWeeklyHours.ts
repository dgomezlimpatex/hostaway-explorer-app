import type { Cleaner, Task } from '@/types/calendar';
import { getTaskAssignedCleanerIds } from './taskAssignments';
import { getTaskWorkerPlannedDurationMinutes, getWindowDurationMinutes } from './cleaning-planning/capacity';

export function planningWeekDates(date: string) {
  // Input is a Madrid civil date, not an instant: UTC arithmetic avoids DST shifts.
  const day = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(day.getTime())) return {startDate:'', endDate:''};
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  const startDate = day.toISOString().slice(0,10);
  day.setUTCDate(day.getUTCDate() + 6);
  return {startDate, endDate:day.toISOString().slice(0,10)};
}

type PreviewItem = {taskId:string; cleanerId:string; task:{date:string;status:string}; startMinute:number; endMinute:number};

// The visible draft replaces saved assignments for these tasks; other days stay intact.
export function planningCalendarWeeklyHours(saved:Task[], cleaners:Cleaner[], replacedIds:Set<string>, items:PreviewItem[], startDate:string, endDate:string) {
  const inWeek = (date:string) => date >= startDate && date <= endDate;
  const hours = new Map(cleaners.map(cleaner => [cleaner.id,0]));
  for (const task of saved) {
    if (!inWeek(task.date) || replacedIds.has(task.id) || ['cancelled','canceled'].includes(task.status)) continue;
    const minutes = getTaskWorkerPlannedDurationMinutes(task) || getWindowDurationMinutes(task.startTime,task.endTime);
    for (const cleanerId of getTaskAssignedCleanerIds(task)) hours.set(cleanerId,(hours.get(cleanerId) ?? 0) + minutes/60);
  }
  for(const item of items) {
    if (!inWeek(item.task.date) || ['cancelled','canceled'].includes(item.task.status)) continue;
    hours.set(item.cleanerId,(hours.get(item.cleanerId) ?? 0) + Math.max(0,item.endMinute-item.startMinute)/60);
  }
  return hours;
}
