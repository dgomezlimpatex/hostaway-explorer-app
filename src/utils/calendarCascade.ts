import { Task } from '@/types/calendar';
import { isTaskAssignedToCleaner } from '@/utils/taskAssignments';
import { getDisplayStatus } from '@/utils/calendarTaskStatus';

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

/** A task that overlaps the drop but is never moved (already started or finished). */
export interface CascadeFixedTask {
  taskId: string;
  property: string;
  startTime: string;
  endTime: string;
  status: string;
}

export interface CascadeResult {
  ok: boolean;
  shifts: CascadeShift[];
  /** Started or finished tasks that stay where they are (the overlap remains). */
  fixed: CascadeFixedTask[];
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

// Started or finished work keeps its real times: the cascade never moves it.
const FIXED_STATUSES = new Set(['in-progress', 'completed']);

/**
 * Shifts forward every task of the same cleaner and day that overlaps the
 * dropped task, or the chain of tasks already shifted after it.
 *
 * Shared tasks: the overlap is measured with this cleaner's share (start →
 * start + total/N), but a shifted task keeps its whole service window, so the
 * planned hours of every assigned person stay the same. Tasks in progress or
 * finished are never moved; they are reported in `fixed` and the chain
 * continues after them so no shifted task lands on top of them. Cancelled
 * tasks are ignored.
 */
export const computeCascadeShifts = (tasks: Task[], input: CascadeInput): CascadeResult => {
  const droppedStart = toMinutes(input.startTime);
  let cursorEnd = toMinutes(input.endTime);

  const sameDayCleanerTasks = tasks
    .filter((t) =>
      t.id !== input.taskId &&
      t.date === input.date &&
      getDisplayStatus(t) !== 'cancelled' &&
      isTaskAssignedToCleaner(t, input.cleanerId, input.cleanerName)
    )
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

  const shifts: CascadeShift[] = [];
  const fixed: CascadeFixedTask[] = [];

  for (const b of sameDayCleanerTasks) {
    const bStart = toMinutes(b.startTime);
    const bEnd = toMinutes(b.endTime);
    const assigned = getAssignedCount(b);
    const fullDuration = Math.max(bEnd - bStart, 0);
    const share = assigned > 1 ? Math.max(15, Math.round(fullDuration / assigned)) : fullDuration;
    const bEffectiveEnd = bStart + share;

    if (bStart >= cursorEnd) break; // no further overlap, stop cascade
    // Finished before the dropped task starts (for multi-worker tasks, the
    // unused part of the block does not count): no conflict.
    if (bEffectiveEnd <= droppedStart) continue;

    const status = getDisplayStatus(b);
    if (FIXED_STATUSES.has(status)) {
      fixed.push({ taskId: b.id, property: b.property, startTime: b.startTime, endTime: b.endTime, status });
      cursorEnd = Math.max(cursorEnd, bEffectiveEnd);
      continue;
    }

    const newStart = cursorEnd;
    const newEnd = newStart + fullDuration;
    if (newEnd > MAX_END) return { ok: false, shifts: [], fixed: [], blockedBy: b.property };

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
    cursorEnd = newStart + share;
  }

  return { ok: true, shifts, fixed };
};

export interface CascadePersistence {
  /**
   * Updates a stored task and resolves to the number of rows changed. It must
   * only change the row while it still has the `expected` times and is not
   * started (pending): a concurrent change or a started task is never
   * overwritten, the update simply changes 0 rows.
   */
  updateTaskTimes: (
    taskId: string,
    startTime: string,
    endTime: string,
    expected: { startTime: string; endTime: string },
  ) => Promise<number>;
  /** Creates the real task for a virtual recurring occurrence. */
  materializeRecurring: (task: Task, startTime: string, endTime: string) => Promise<unknown>;
}

export interface CascadePersistResult {
  saved: CascadeShift[];
  failed: Array<{ shift: CascadeShift; error: unknown }>;
}

const persistOne = async (shift: CascadeShift, task: Task | undefined, persistence: CascadePersistence) => {
  if (task?.isRecurringInstance) {
    await persistence.materializeRecurring(task, shift.newStartTime, shift.newEndTime);
    return;
  }
  const changed = await persistence.updateTaskTimes(shift.taskId, shift.newStartTime, shift.newEndTime, {
    startTime: shift.oldStartTime,
    endTime: shift.oldEndTime,
  });
  // 0 rows: it changed meanwhile (other person, started...) and was left as is.
  if (changed < 1) throw new Error(`No se pudo mover "${shift.property}": ha cambiado mientras tanto`);
};

/**
 * Saves every shift. Virtual recurring occurrences have no row to update, so
 * they are materialized; an update that changes no row is an error, so the
 * caller never reports (or emails) a shift that was not saved. Rejects with
 * the first error when any shift fails.
 */
export const persistCascadeShifts = async (
  shifts: CascadeShift[],
  tasks: Task[],
  persistence: CascadePersistence,
): Promise<CascadeShift[]> => {
  const result = await persistCascadeShiftsSettled(shifts, tasks, persistence);
  if (result.failed.length > 0) throw result.failed[0].error;
  return result.saved;
};

/** Same as persistCascadeShifts but reports which shifts were saved and which failed. */
export const persistCascadeShiftsSettled = async (
  shifts: CascadeShift[],
  tasks: Task[],
  persistence: CascadePersistence,
): Promise<CascadePersistResult> => {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const results = await Promise.allSettled(
    shifts.map((shift) => persistOne(shift, tasksById.get(shift.taskId), persistence)),
  );
  const saved: CascadeShift[] = [];
  const failed: CascadePersistResult['failed'] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') saved.push(shifts[index]);
    else failed.push({ shift: shifts[index], error: result.reason });
  });
  return { saved, failed };
};

/**
 * Puts back the stored tasks that were already shifted when the rest of the
 * cascade failed, only while they still have the times this cascade wrote
 * (and are still pending): a change made by someone else in between, or a
 * task already started, is never overwritten and is reported instead.
 * Recurring occurrences already materialized are not deleted either.
 * This is a compensation, not an atomic transaction.
 */
export const revertCascadeShifts = async (
  saved: CascadeShift[],
  tasks: Task[],
  persistence: Pick<CascadePersistence, 'updateTaskTimes'>,
): Promise<{ reverted: CascadeShift[]; notReverted: CascadeShift[] }> => {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const reverted: CascadeShift[] = [];
  const notReverted: CascadeShift[] = [];
  for (const shift of saved) {
    if (tasksById.get(shift.taskId)?.isRecurringInstance) {
      notReverted.push(shift);
      continue;
    }
    try {
      const changed = await persistence.updateTaskTimes(shift.taskId, shift.oldStartTime, shift.oldEndTime, {
        startTime: shift.newStartTime,
        endTime: shift.newEndTime,
      });
      (changed > 0 ? reverted : notReverted).push(shift);
    } catch {
      notReverted.push(shift);
    }
  }
  return { reverted, notReverted };
};
