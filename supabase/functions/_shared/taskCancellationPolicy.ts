const DELETABLE_TASK_STATUS = 'pending';

export function normalizeTaskStatus(status: string | null | undefined): string {
  return String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}

/**
 * PMS cancellations may only remove tasks that have not started yet.
 * Unknown states are preserved deliberately: destructive integrations fail closed.
 */
export function canDeleteTaskAfterPmsCancellation(
  status: string | null | undefined,
): boolean {
  return normalizeTaskStatus(status) === DELETABLE_TASK_STATUS;
}
