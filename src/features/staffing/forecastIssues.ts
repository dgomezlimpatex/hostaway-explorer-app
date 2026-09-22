import { validDate, type ForecastDataset, type ForecastIssue } from './forecastContract';

/** Preserve the record's time bounds before aggregating any diagnostic. Unknown bounds stay global. */
export function scopeIssue(issue: ForecastIssue, data: Pick<ForecastDataset, 'tasks' | 'absences' | 'properties'>): ForecastIssue {
  if (issue.date || issue.from || issue.to) return issue;
  const absence = issue.source === 'worker_absences' ? data.absences.find(a => issue.ids.includes(a.id)) : undefined;
  if (absence && validDate(absence.from) && validDate(absence.to) && absence.from <= absence.to) {
    return { ...issue, from: absence.from, to: absence.to, workerId: absence.workerId };
  }
  const tasks = data.tasks.filter(t => issue.ids.includes(t.id));
  if (tasks.length === 1 && validDate(tasks[0].date)) return { ...issue, date: tasks[0].date, centerId: tasks[0].centerId };
  const centers = new Set((data.properties ?? []).filter(p => issue.ids.includes(p.id)).map(p => p.centerId));
  if (centers.size === 1) return { ...issue, centerId: [...centers][0] };
  return issue;
}

export function issueDuring(issue: ForecastIssue, from: string, to = from) {
  if (issue.date) return issue.date >= from && issue.date <= to;
  return (!issue.from || issue.from <= to) && (!issue.to || issue.to >= from);
}
