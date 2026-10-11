import { Task } from '@/types/calendar';
import { isTaskAssignedToCleaner } from '@/utils/taskAssignments';

export interface CascadeShift {
  taskId: string;
  property: string;
  address?: string;
  type?: string;
  oldStartTime: string;
  oldEndTime: string;
  newStartTime: string;
  newEndTime: string;
}

export interface CascadeInput {
  taskId: string;
  date: string;
  startTime: string;
  endTime: string;
  cleanerId: string;
  cleanerName: string;
}

export interface CascadeResult {
  ok: boolean;
  shifts: CascadeShift[];
  /** Property that would end after 23:59 when ok is false. */
  blockedBy?: string;
}

const MAX_END = 23 * 60 + 59;

export const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const fromMinutes = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

// Multi-worker tasks split their duration evenly between the assigned people.
const getAssignedCount = (task: Task): number => {
  if (Array.isArray(task.assignments) && task.assignments.length > 0) return task.assignments.length;
  if (typeof task.cleaner === 'string' && task.cleaner.includes(',')) {
    return task.cleaner.split(',').map((s) => s.trim()).filter(Boolean).length;
  }
  return 1;
};

/**
 * Shifts forward every task of the same cleaner and day that overlaps the
 * dropped task, or the chain of tasks already shifted after it.
 */
export const computeCascadeShifts = (tasks: Task[], input: CascadeInput): CascadeResult => {
  const droppedStart = toMinutes(input.startTime);
  let cursorEnd = toMinutes(input.endTime);

  const sameDayCleanerTasks = tasks
    .filter((t) =>
      t.id !== input.taskId &&
      t.date === input.date &&
      isTaskAssignedToCleaner(t, input.cleanerId, input.cleanerName)
    )
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

  const shifts: CascadeShift[] = [];

  for (const b of sameDayCleanerTasks) {
    const bStart = toMinutes(b.startTime);
    const bEnd = toMinutes(b.endTime);
    const assigned = getAssignedCount(b);
    const fullDuration = Math.max(bEnd - bStart, 0);
    const duration = assigned > 1 ? Math.max(15, Math.round(fullDuration / assigned)) : fullDuration;
    const bEffectiveEnd = bStart + duration;

    if (bStart >= cursorEnd) break; // no further overlap, stop cascade
    // Finished before the dropped task starts (for multi-worker tasks, the
    // unused part of the block does not count): no conflict.
    if (bEffectiveEnd <= droppedStart) continue;

    const newStart = cursorEnd;
    const newEnd = newStart + duration;
    if (newEnd > MAX_END) return { ok: false, shifts: [], blockedBy: b.property };

    shifts.push({
      taskId: b.id,
      property: b.property,
      address: b.address,
      type: b.type,
      oldStartTime: b.startTime,
      oldEndTime: b.endTime,
      newStartTime: fromMinutes(newStart),
      newEndTime: fromMinutes(newEnd),
    });
    cursorEnd = newEnd;
  }

  return { ok: true, shifts };
};

export interface CascadePersistence {
  /** Updates a stored task and resolves to the number of rows changed. */
  updateTaskTimes: (taskId: string, startTime: string, endTime: string) => Promise<number>;
  /** Creates the real task for a virtual recurring occurrence. */
  materializeRecurring: (task: Task, startTime: string, endTime: string) => Promise<unknown>;
}

/**
 * Saves every shift. Virtual recurring occurrences have no row to update, so
 * they are materialized; an update that changes no row is an error, so the
 * caller never reports (or emails) a shift that was not saved.
 */
export const persistCascadeShifts = async (
  shifts: CascadeShift[],
  tasks: Task[],
  persistence: CascadePersistence,
): Promise<CascadeShift[]> => {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  await Promise.all(shifts.map(async (shift) => {
    const task = tasksById.get(shift.taskId);
    if (task?.isRecurringInstance) {
      await persistence.materializeRecurring(task, shift.newStartTime, shift.newEndTime);
      return;
    }
    const changed = await persistence.updateTaskTimes(shift.taskId, shift.newStartTime, shift.newEndTime);
    if (changed < 1) throw new Error(`No se pudo mover "${shift.property}"`);
  }));
  return shifts;
};
