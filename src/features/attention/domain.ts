import type { Task } from '@/types/calendar';
import type { TaskReport } from '@/types/taskReports';
import { formatMadridDate, formatMadridDateTime } from '@/utils/date';
import { getTaskAssignedCleanerIds } from '@/utils/taskAssignments';
import { getTaskWorkerPlannedDurationMinutes } from '@/utils/cleaning-planning/capacity';
import { getEffectiveTaskEndTime } from '@/utils/taskPositioning';

export const alertKinds = ['unfinished', 'missing-report', 'late-start', 'duration'] as const;
export type AlertKind = typeof alertKinds[number];
export const alertLabels: Record<AlertKind, string> = {
  unfinished: 'Sin finalizar', 'missing-report': 'Sin reporte',
  'late-start': 'Inicio pendiente', duration: 'Duración a revisar',
};
export interface AttentionAlert {
  key: string;
  taskId: string;
  taskDate: string;
  sedeId: string;
  cleanerId: string;
  cleanerName: string;
  property: string;
  client: string;
  kind: AlertKind;
  title: string;
  detail: string;
  magnitude: number;
  reportId: string | null;
}
export interface AttentionGroup { task: Task; alerts: AttentionAlert[] }
export interface AttentionIssue { taskId: string; property: string; message: string }
export interface AttentionReview {
  id: string;
  sede_id: string;
  task_id: string | null;
  task_date: string;
  alert_key: string;
  kind: AlertKind;
  snapshot: AttentionAlert;
  reviewed_by: string | null;
  reviewed_by_name: string;
  reviewed_at: string;
}

// Interpret local planned times in Madrid even when the browser uses another zone.
export function madridTimestamp(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)) return null;
  const wall = `${date}T${time.slice(0, 5)}`;
  const target = Date.parse(wall + ':00Z');
  if (!Number.isFinite(target)) return null;
  let candidate = target;
  for (let i = 0; i < 3; i++) {
    const observed = Date.parse(formatMadridDateTime(new Date(candidate)) + ':00Z');
    candidate += target - observed;
  }
  return formatMadridDateTime(new Date(candidate)) === wall ? candidate : null;
}

const timestamp = (value?: string | null) => {
  if (!value || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};
export function buildAttention(
  tasks: Task[], reports: TaskReport[], sedeId: string, now: Date, reviewedKeys: Set<string> = new Set(),
): { groups: AttentionGroup[]; issues: AttentionIssue[] } {
  const groups: AttentionGroup[] = [];
  const issues: AttentionIssue[] = [];
  const date = formatMadridDate(now);
  const reportsByTask = new Map<string, TaskReport[]>();
  for (const report of reports) {
    const bucket = reportsByTask.get(report.task_id) || [];
    bucket.push(report); reportsByTask.set(report.task_id, bucket);
  }
  for (const task of tasks) {
    if (task.sedeId !== sedeId || task.date !== date || task.isRecurringInstance || (task.status as string) === 'cancelled') continue;
    const cleanerIds = getTaskAssignedCleanerIds(task).sort();
    if (!cleanerIds.length) continue;
    const start = madridTimestamp(task.date, task.startTime);
    const planned = getTaskWorkerPlannedDurationMinutes(task);
    const endTime = cleanerIds.length > 1 && planned <= 0 ? '' : getEffectiveTaskEndTime(task);
    const end = madridTimestamp(task.date, endTime);
    if (start === null || end === null || end <= start || planned <= 0) {
      issues.push({ taskId: task.id, property: task.property, message: 'Faltan horarios o una duración prevista fiables; no se pueden comprobar todos los avisos.' });
    }
    const alerts: AttentionAlert[] = [];
    for (const cleanerId of cleanerIds) {
      const candidates = (reportsByTask.get(task.id) || []).filter(r => r.cleaner_id === cleanerId || (!r.cleaner_id && cleanerIds.length === 1));
      // Multiple reports cannot safely be interpreted as one continuous interval.
      if (candidates.length > 1 || (cleanerIds.length > 1 && (reportsByTask.get(task.id) || []).some(r => !r.cleaner_id))) {
        issues.push({taskId: task.id, property: task.property, message: 'Hay reportes duplicados o sin trabajadora identificada; revisar los datos.'});
        continue;
      }
      const report = candidates[0];
      const actualStart = timestamp(report?.start_time);
      const actualEnd = timestamp(report?.end_time);
      const closed = report?.overall_status === 'completed' || (report?.overall_status === 'needs_review' && actualEnd !== null);
      const initiated = actualStart !== null || (!!report && report.overall_status !== 'pending');
      if (report && !closed && ((initiated && actualStart === null) || (actualStart !== null && actualStart > now.getTime()))) {
        issues.push({taskId: task.id, property: task.property, message: 'El reporte no tiene un inicio real válido; no se puede calcular su duración.'});
      }
      const cleanerName = task.assignments?.find(a => a.cleaner_id === cleanerId)?.cleaner_name || (cleanerIds.length === 1 ? task.cleaner : '') || 'Trabajadora sin nombre';
      const add = (kind: AlertKind, title: string, detail: string, magnitude: number, direction = '') => {
        // No ticking clock, updated_at or display names: a reviewed occurrence stays reviewed.
        const key = JSON.stringify([task.id, cleanerId, kind, direction, task.date, task.startTime, endTime, planned, cleanerIds, report?.id || null, report?.start_time || null, report?.end_time || null, report?.overall_status || null]);
        if (!reviewedKeys.has(key)) alerts.push({key, taskId: task.id, taskDate: task.date, sedeId, cleanerId, cleanerName, property: task.property, client: task.client || '', kind, title, detail, magnitude, reportId: report?.id || null});
      };
      if (!initiated && !closed) {
        if (end !== null && now.getTime() >= end + 15 * 60000) {
          const late = Math.floor((now.getTime() - end) / 60000);
          add('missing-report', 'Sin reporte iniciado', `Fin previsto: ${endTime.slice(0, 5)} · hace ${late} min`, late);
        } else if (start !== null && now.getTime() >= start + 15 * 60000) {
          const late = Math.floor((now.getTime() - start) / 60000);
          add('late-start', `No consta inicio · ${late} min de retraso`, `Inicio previsto: ${task.startTime.slice(0, 5)}`, late);
        }
      } else if (!closed && end !== null && now.getTime() >= end + 60 * 60000) {
        const late = Math.floor((now.getTime() - end) / 60000);
        add('unfinished', 'Tarea sin finalizar', `Fin previsto: ${endTime.slice(0, 5)} · sigue abierta ${late} min después`, late);
      } else if (closed) {
        if (actualStart === null || actualEnd === null || actualEnd <= actualStart || actualEnd > now.getTime() || planned <= 0) {
          issues.push({taskId: task.id, property: task.property, message: `${cleanerName}: faltan tiempos válidos para comparar la duración.`});
          continue;
        }
        const actual = (actualEnd - actualStart) / 60000;
        const delta = actual - planned;
        const percent = delta / planned * 100;
        if (Math.abs(delta) >= 15 && Math.abs(percent) >= 25) {
          const sign = delta > 0 ? '+' : '−';
          add('duration', `Duración ${delta > 0 ? 'superior' : 'inferior'} a la prevista · ${sign}${Math.round(Math.abs(delta))} min (${sign}${Math.round(Math.abs(percent))}%)`, `Previsto: ${planned} min · registrado: ${Math.round(actual)} min`, Math.abs(delta), delta > 0 ? 'long' : 'short');
        }
      }
    }
    alerts.sort(compareAlerts);
    if (alerts.length) groups.push({task, alerts});
  }
  groups.sort((a, b) => compareAlerts(a.alerts[0], b.alerts[0]) || a.task.id.localeCompare(b.task.id));
  return {groups, issues: issues.filter((issue, i, all) => all.findIndex(other => other.taskId === issue.taskId && other.message === issue.message) === i)};
}
function compareAlerts(a: AttentionAlert, b: AttentionAlert) {
  return alertKinds.indexOf(a.kind) - alertKinds.indexOf(b.kind) || b.magnitude - a.magnitude || a.key.localeCompare(b.key);
}
