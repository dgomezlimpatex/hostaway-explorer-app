/**
 * Who stays assigned when a task block is dropped on a cleaner row. Agreed
 * with Dani (20/10/2026):
 * - same row, or the target already works on the task: the team is kept and
 *   only the schedule changes (nobody is added twice or removed silently);
 * - another row: only the person of the row the block was dragged from is
 *   replaced, the coworkers stay;
 * - unassigned task (or origin unknown): the target becomes the only person.
 */
export type DropAssignmentKind = 'keep-team' | 'replace-origin' | 'assign';

export interface DropAssignment {
  kind: DropAssignmentKind;
  /** Passed to reassignTaskKeepingCoworkers as the replaced cleaner. */
  replacedCleanerId?: string;
  nextCleanerIds: string[];
}

const unique = (ids: Array<string | null | undefined>) =>
  Array.from(new Set(ids.filter((id): id is string => Boolean(id))));

export const resolveDropAssignment = (
  previousCleanerIds: Array<string | null | undefined>,
  originCleanerId: string | null | undefined,
  targetCleanerId: string,
): DropAssignment => {
  const previous = unique(previousCleanerIds);
  if (previous.includes(targetCleanerId)) {
    return { kind: 'keep-team', replacedCleanerId: targetCleanerId, nextCleanerIds: previous };
  }
  if (originCleanerId && previous.includes(originCleanerId)) {
    return {
      kind: 'replace-origin',
      replacedCleanerId: originCleanerId,
      nextCleanerIds: [...previous.filter((id) => id !== originCleanerId), targetCleanerId],
    };
  }
  return { kind: 'assign', nextCleanerIds: [targetCleanerId] };
};

/** Cleaners left after removing one person from a (shared) task. */
export const withoutCleaner = (previousCleanerIds: Array<string | null | undefined>, cleanerId: string) =>
  unique(previousCleanerIds).filter((id) => id !== cleanerId);
