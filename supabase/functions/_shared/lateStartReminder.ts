export const LATE_START_GRACE_MINUTES = 30;

export interface TaskReportStartState {
  start_time?: string | null;
  overall_status?: string | null;
}

/**
 * Un reporte cuenta como iniciado en cuanto registra la hora real de inicio o
 * entra en progreso/completado. No depende de tasks.status, que permanece
 * pending durante la ejecución de la limpieza.
 */
export function hasTaskReportStarted(reports: TaskReportStartState[] | null | undefined): boolean {
  return (reports ?? []).some((report) => {
    const hasStartTime = typeof report.start_time === 'string' && report.start_time.trim().length > 0;
    return hasStartTime || ['in_progress', 'completed', 'needs_review'].includes(report.overall_status ?? '');
  });
}

/** Resta minutos a una hora HH:MM sin envolver al día anterior. */
export function subtractMinutesFromTime(hhmm: string, minutes: number): string {
  const [hours, minutePart] = hhmm.split(':').map((value) => Number.parseInt(value, 10));
  const total = Math.max(0, hours * 60 + minutePart - minutes);
  const nextHours = Math.floor(total / 60).toString().padStart(2, '0');
  const nextMinutes = (total % 60).toString().padStart(2, '0');
  return `${nextHours}:${nextMinutes}`;
}

export function lateStartThreshold(nowMadrid: string): string {
  return subtractMinutesFromTime(nowMadrid, LATE_START_GRACE_MINUTES);
}
