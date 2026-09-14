import { formatMadridDate } from '@/utils/date';

export interface RecurringExecution {
  recurring_task_id: string;
  execution_date: string;
}

// Fetch a UTC superset of the civil date range, including Madrid midnight
// on the preceding UTC day in both winter and summer.
export const recurringExecutionBounds = (from: string, to: string) => {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 1);
  end.setUTCDate(end.getUTCDate() + 1);
  return { from: start.toISOString(), until: end.toISOString() };
};

export const buildRecurringExecutionSet = (executions: RecurringExecution[]) =>
  new Set(executions.map((execution) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(execution.execution_date)
      ? execution.execution_date
      : formatMadridDate(new Date(execution.execution_date));
    return `${execution.recurring_task_id}_${date}`;
  }));
