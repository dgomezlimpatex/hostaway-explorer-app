export interface CalendarProgressReport {
  cleaner_id?: string | null;
  overall_status?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

// Read-only display status: starting a report does not update tasks.status.
export function getCalendarTaskStatus(status: string, reports: CalendarProgressReport[] = [], assignedIds: string[] = []): string {
  if (status === 'cancelled') return status;
  const assigned = [...new Set(assignedIds.filter(Boolean))];
  const relevant = reports.filter(report => !report.cleaner_id || !assigned.length || assigned.includes(report.cleaner_id));
  if (!relevant.length) return status === 'in_progress' ? 'in-progress' : status;
  const validTime = (value?: string | null) => !!value && Number.isFinite(Date.parse(value));
  const closed = (report: CalendarProgressReport) => report.overall_status === 'completed' ||
    (report.overall_status === 'needs_review' && validTime(report.end_time));
  const started = (report: CalendarProgressReport) => report.overall_status === 'in_progress' ||
    report.overall_status === 'in-progress' || validTime(report.start_time) || closed(report);
  if (relevant.some(report => started(report) && !closed(report))) return 'in-progress';
  if (assigned.length > 1) {
    if (assigned.every(id => relevant.some(report => report.cleaner_id === id && closed(report)))) return 'completed';
    if (relevant.some(started)) return 'in-progress';
    return 'pending';
  }
  if (relevant.some(closed)) return 'completed';
  return status === 'completed' ? 'pending' : status === 'in_progress' ? 'in-progress' : status;
}
