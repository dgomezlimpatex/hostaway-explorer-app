import { calculateOccurrences, type RecurringSchedule } from '../../../supabase/functions/_shared/recurringSchedule';
import { validDate, type ForecastIssue } from './forecastContract';
import type { StaffingRow } from './data';
import { formatMadridDate } from '../../utils/date';

// Legacy calendar executions predate execution_day. Apply the calendar's Madrid conversion,
// never the machine's timezone or a UTC date slice. An explicit invalid civil date stays unknown.
function executionDay(execution: StaffingRow): string | undefined {
  if (execution.execution_day != null) return validDate(String(execution.execution_day)) ? String(execution.execution_day) : undefined;
  const recorded = String(execution.execution_date ?? '');
  if (validDate(recorded)) return recorded;
  if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/i.test(recorded)) return undefined;
  const instant = new Date(recorded);
  return Number.isFinite(instant.getTime()) ? formatMadridDate(instant) : undefined;
}

/** Calendar's civil-date schedule, expanded in memory only. Execution identity wins over the template. */
export function expandForecastRecurrences(templates: StaffingRow[], executions: StaffingRow[], tasks: StaffingRow[], from: string, to: string, issues: ForecastIssue[], executionsAvailable: boolean) {
  const result = [...tasks];
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  for (const template of templates) {
    const id = String(template.id), workerId = typeof template.cleaner_id === 'string' ? template.cleaner_id : undefined;
    if (template.end_date && String(template.end_date) < from) continue;
    const issue = (code: string, message: string, date?: string) => issues.push({ code, message, source: 'recurring_tasks', impact: 'capacity', ids: [id, ...(workerId ? [workerId] : [])], workerId, ...(date ? { date } : { from, to }) });
    if (!executionsAvailable) continue; // A failed source already blocks verification; never risk duplicates.
    const history: (StaffingRow & { forecastDay: string | undefined })[] = executions.filter(e => e.recurring_task_id === id && e.success === true).map(e => ({ ...e, forecastDay: executionDay(e) }));
    if (history.some(e => !e.forecastDay)) {
      issue('recurrence-identity-unverified', 'Una ejecución recurrente no tiene fecha civil verificable. Revisar la recurrencia antes de sumar horas.');
      continue;
    }
    const schedule: RecurringSchedule = { frequency: String(template.frequency), start_date: String(template.start_date), end_date: template.end_date ? String(template.end_date) : null, interval_days: template.interval_days == null ? 1 : Number(template.interval_days), days_of_week: template.days_of_week as number[] | null, day_of_month: template.day_of_month == null ? null : Number(template.day_of_month) };
    let occurrences: string[];
    try {
      if (!validDate(schedule.start_date) || schedule.end_date && (!validDate(schedule.end_date) || schedule.end_date < schedule.start_date) || !Number.isInteger(schedule.interval_days) || schedule.interval_days! < 1 || schedule.days_of_week != null && (!Array.isArray(schedule.days_of_week) || !schedule.days_of_week.length || schedule.days_of_week.some(d => !Number.isInteger(d) || d < 0 || d > 6)) || schedule.day_of_month != null && (!Number.isInteger(schedule.day_of_month) || schedule.day_of_month < 1 || schedule.day_of_month > 31)) throw new Error('Patrón inválido');
      occurrences = calculateOccurrences(schedule, from, to);
    } catch { issue('invalid-recurrence', 'El patrón recurrente no se puede verificar. Revisar fechas, frecuencia e intervalo.'); continue; }
    for (const date of occurrences) {
      const matches = history.filter(e => e.forecastDay === date);
      if (matches.length) {
        if (matches.length > 1) issue('recurrence-identity-unverified', 'Hay varias ejecuciones para la misma fecha recurrente; revisar sus tareas vinculadas.', date);
        for (const execution of matches) {
          if (!execution.generated_task_id) continue; // Explicitly handled/cancelled, as in the operational calendar.
          const real = taskMap.get(execution.generated_task_id);
          if (!real) issue('recurrence-task-unavailable', 'La recurrencia ya se gestionó, pero su tarea vinculada no está en los datos leídos. Revisar en calendario; no se genera otra copia.', date);
          else { const index = result.indexOf(real); if (index >= 0) result[index] = { ...real, forecast_source: 'materialized', recurring_id: id }; }
        }
        continue;
      }
      result.push({ ...template, id: `recurring_${id}_${date}`, date, status: 'pending', forecast_source: 'recurring', recurring_id: id });
    }
  }
  return result;
}
