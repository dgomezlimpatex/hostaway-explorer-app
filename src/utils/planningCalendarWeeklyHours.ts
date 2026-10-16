import type { Cleaner, Task } from '@/types/calendar';
import type { WorkerMaintenanceCleaning } from '@/types/workerAbsence';
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

export function planningWeekDays(startDate: string, endDate: string) {
  const days: string[] = [];
  if (!startDate || !endDate) return days;
  const day = new Date(`${startDate}T12:00:00Z`);
  while (!Number.isNaN(day.getTime()) && day.toISOString().slice(0,10) <= endDate && days.length < 31) {
    days.push(day.toISOString().slice(0,10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return days;
}

// One request per day keeps each response far below the API page size of 1000 rows.
export async function fetchPlanningWeekTasks(startDate: string, endDate: string, fetchDay: (date: string) => Promise<Task[]>) {
  const days = await Promise.all(planningWeekDays(startDate, endDate).map(fetchDay));
  return days.flat();
}

type PreviewItem = {taskId:string; cleanerId:string; task:{date:string;status:string}; startMinute:number; endMinute:number};
type MaintenanceSchedule = Pick<WorkerMaintenanceCleaning, 'cleanerId' | 'daysOfWeek' | 'startTime' | 'endTime' | 'isActive' | 'scheduleType'>;

// The visible draft replaces saved assignments for these tasks; other days stay intact.
// Maintenance schedules repeat on their weekdays; unavailability blocks are not work.
export function planningCalendarWeeklyHours(saved:Task[], cleaners:Cleaner[], replacedIds:Set<string>, items:PreviewItem[], startDate:string, endDate:string, maintenance:MaintenanceSchedule[] = []) {
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
  const weekdays = planningWeekDays(startDate,endDate).map(date => new Date(`${date}T12:00:00Z`).getUTCDay());
  for (const schedule of maintenance) {
    if (!schedule.isActive || schedule.scheduleType === 'unavailability') continue;
    const occurrences = weekdays.filter(day => (schedule.daysOfWeek || []).includes(day)).length;
    const minutes = getWindowDurationMinutes(schedule.startTime,schedule.endTime) * occurrences;
    if (minutes) hours.set(schedule.cleanerId,(hours.get(schedule.cleanerId) ?? 0) + minutes/60);
  }
  return hours;
}
