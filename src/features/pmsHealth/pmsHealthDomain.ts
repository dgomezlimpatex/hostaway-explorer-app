/**
 * Salud de las integraciones con PMS (Smoobu y Little Hotelier).
 *
 * Este módulo es puro: recibe evidencia ya leída y devuelve un estado. No consulta
 * la base de datos, no escribe nada y no inicia ninguna sincronización.
 *
 * Regla de fondo: el estado se deduce de lo que hay registrado. Un proceso que
 * «terminó bien» no basta; si falta una prueba de que se importaron datos, el
 * estado no puede ser verde.
 */
import { formatMadridDate } from '@/utils/date';
import { shiftCivilDate } from '@/utils/madridCalendar';

export type PmsId = 'smoobu' | 'little_hotelier';

export type PmsHealthStatus =
  | 'up_to_date'
  | 'warnings'
  | 'stale'
  | 'error'
  | 'running'
  | 'insufficient'
  | 'disabled';

export type PmsHealthTone = 'ok' | 'warning' | 'danger' | 'info' | 'neutral';

export const PMS_STATUS_LABEL: Record<PmsHealthStatus, string> = {
  up_to_date: 'Al día',
  warnings: 'Con advertencias',
  stale: 'Datos desactualizados',
  error: 'Error',
  running: 'En ejecución',
  insufficient: 'Sin información suficiente',
  disabled: 'Desactivada',
};

export const PMS_STATUS_TONE: Record<PmsHealthStatus, PmsHealthTone> = {
  up_to_date: 'ok',
  warnings: 'warning',
  stale: 'warning',
  error: 'danger',
  running: 'info',
  insufficient: 'neutral',
  disabled: 'neutral',
};

/** Una fuente de lectura: o llegó, o falló. Un fallo nunca equivale a «sin datos». */
export type EvidenceSource<T> = { state: 'ok'; data: T } | { state: 'error' };

export type AttemptOutcome =
  /** Se recibieron datos y no hubo fallos. */
  | 'success'
  /** Se recibieron datos, pero una parte falló. */
  | 'partial'
  /** Todo lo recibido falló o la petición terminó en error. */
  | 'failed'
  /** El proceso terminó, pero no hay prueba de que importara nada. */
  | 'no_data';

export interface Attempt {
  /** Cuándo quedó registrado (ISO). */
  at: string;
  /** Cuándo empezó, solo si la fuente lo registra. */
  startedAt: string | null;
  kind: 'scheduled' | 'manual' | 'unknown';
  outcome: AttemptOutcome;
  read: number;
  created: number;
  /** null cuando la fuente no permite saberlo con fiabilidad. */
  modified: number | null;
  cancelled: number;
  failed: number;
  /** Mensajes ya depurados, sin datos personales. */
  errorSummaries: string[];
}

export interface InFlight {
  phase: 'queued' | 'running';
  since: string;
}

export interface PendingLinkItem {
  label: string;
  count: number;
}

export interface PendingLinks {
  /** Reservas afectadas (sin duplicar). */
  total: number;
  items: PendingLinkItem[];
  /** La consulta pudo dejar filas fuera por su límite. */
  incomplete: boolean;
}

export interface ExpectedSchedule {
  /** Horas «HH:MM» de Madrid en las que se espera una pasada. */
  times: string[];
  /** Minutos de cortesía antes de dar una pasada por no ejecutada. */
  graceMinutes: number;
}

export interface PmsEvidence {
  integration: PmsId;
  now: Date;
  /** Solo true/false cuando la configuración lo confirma; null si no hay forma de saberlo. */
  enabled: boolean | null;
  attempts: EvidenceSource<Attempt[]>;
  inFlight: EvidenceSource<InFlight[]>;
  schedule: ExpectedSchedule | null;
  pendingLinks: EvidenceSource<PendingLinks> | { state: 'unavailable' };
  /** Intentos que no cuentan (p. ej. simulaciones) y se muestran aparte. */
  ignoredAttempts: number;
}

export type FindingCode =
  | 'last_attempt_failed'
  | 'partial_failure'
  | 'no_data_read'
  | 'not_run'
  | 'stuck'
  | 'request_unattended'
  | 'pending_links'
  | 'pending_links_incomplete'
  | 'pending_links_unavailable'
  | 'in_flight_unavailable'
  | 'no_reference_frequency'
  | 'ignored_simulations';

export interface Finding {
  code: FindingCode;
  severity: 'danger' | 'warning' | 'info';
  text: string;
}

export interface AttemptView {
  at: string;
  startedAt: string | null;
  ageMinutes: number;
  kind: Attempt['kind'];
  outcome: AttemptOutcome;
  read: number;
  created: number;
  modified: number | null;
  cancelled: number;
  failed: number;
  /** «No hay nuevas reservas» solo cuando hubo lectura y ningún cambio. */
  noNewReservations: boolean;
}

export interface PmsHealth {
  integration: PmsId;
  status: PmsHealthStatus;
  label: string;
  tone: PmsHealthTone;
  headline: string;
  findings: Finding[];
  lastAttempt: AttemptView | null;
  lastSuccess: AttemptView | null;
  /** Pasada esperada que no consta (solo con horario conocido). */
  overduePass: { label: string; at: string } | null;
  frequencyKnown: boolean;
  /** Horas de Madrid esperadas, o null si no hay frecuencia fiable. */
  scheduleTimes: string[] | null;
  inFlight: InFlight | null;
  lastErrorSummaries: string[];
  lastErrorAt: string | null;
  pendingLinks: PendingLinks | null;
  /** La parte de incidencias no se pudo leer. */
  pendingLinksUnavailable: boolean;
  diagnosticReadFailed: boolean;
  ignoredAttempts: number;
}

/** Una sincronización manual en curso más allá de esto parece atascada (las reales duran segundos). */
export const RUNNING_STUCK_MINUTES = 30;
/** Una petición manual que nadie ha recogido en este tiempo se considera sin atender. */
export const QUEUED_UNATTENDED_MINUTES = 15;
/** Un intento registrado hasta este margen antes de la hora esperada sigue cubriendo la pasada. */
export const SCHEDULE_EARLY_TOLERANCE_MINUTES = 10;

const MINUTE = 60_000;

// ---------------------------------------------------------------------------
// Horas de Madrid
// ---------------------------------------------------------------------------

const MADRID_TZ = 'Europe/Madrid';

const madridOffsetMs = (date: Date): number => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MADRID_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

/** Instante real de una hora de reloj de Madrid, correcto con el cambio de hora. */
export const madridWallTimeToDate = (day: string, time: string): Date => {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const naive = Date.UTC(year, month - 1, date, hour, minute);
  let guess = naive - madridOffsetMs(new Date(naive));
  guess = naive - madridOffsetMs(new Date(guess));
  return new Date(guess);
};

/** Última pasada esperada que ya debería constar, descontando la cortesía. */
export const latestExpectedPass = (
  now: Date,
  schedule: ExpectedSchedule,
): { at: Date; label: string } | null => {
  const limit = now.getTime() - schedule.graceMinutes * MINUTE;
  const today = formatMadridDate(now);
  let best: { at: Date; label: string } | null = null;
  for (const day of [today, shiftCivilDate(today, -1), shiftCivilDate(today, -2)]) {
    for (const time of schedule.times) {
      const at = madridWallTimeToDate(day, time);
      if (at.getTime() > limit) continue;
      if (!best || at.getTime() > best.at.getTime()) best = { at, label: time };
    }
  }
  return best;
};

export const formatMadridStamp = (iso: string | Date | null | undefined): string => {
  if (!iso) return '—';
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: MADRID_TZ,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
};

export const ageInMinutes = (iso: string, now: Date): number | null => {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((now.getTime() - time) / MINUTE));
};

export const formatAge = (minutes: number | null): string => {
  if (minutes === null) return 'sin fecha';
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} días`;
};

// ---------------------------------------------------------------------------
// Resumen de error seguro
// ---------------------------------------------------------------------------

const MAX_SUMMARY_LENGTH = 140;

const statusCodeText = (statusCode: number | null | undefined): string | null => {
  if (statusCode === null || statusCode === undefined) return null;
  if (statusCode === 401 || statusCode === 403) return `Acceso rechazado (${statusCode})`;
  if (statusCode === 408 || statusCode === 504) return `Tiempo de espera agotado (${statusCode})`;
  if (statusCode === 429) return 'Demasiadas peticiones (429)';
  if (statusCode >= 500) return `Error del servicio (${statusCode})`;
  if (statusCode >= 400) return `Datos rechazados (${statusCode})`;
  return null;
};

/**
 * Deja un mensaje de error apto para mostrar: sin trazas, enlaces, correos,
 * claves ni números largos (teléfonos, identificadores). Nunca devuelve el
 * texto original sin depurar.
 */
export const safeErrorSummary = (raw: unknown, statusCode?: number | null): string | null => {
  const lead = statusCodeText(statusCode);
  let text = typeof raw === 'string' ? raw : raw === null || raw === undefined ? '' : String(raw);
  text = text
    .split(/\r?\n/)
    .filter((line) => line.trim() && !/^\s*at\s+\S+/.test(line))
    .join(' ')
    .replace(/https?:\/\/\S+/gi, '[enlace]')
    .replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, '[correo]')
    .replace(/\b(bearer|token|apikey|api[_-]?key|authorization|password|secret)\b\s*[:=]?\s*\S+/gi, '$1 [oculto]')
    .replace(/\b[A-Za-z0-9_-]{28,}\b/g, '[código]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[nº]')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > MAX_SUMMARY_LENGTH) text = `${text.slice(0, MAX_SUMMARY_LENGTH - 1).trimEnd()}…`;
  if (lead && text) return `${lead}: ${text}`;
  return lead ?? (text || null);
};

/** Junta mensajes iguales y devuelve como mucho `limit`, con su número de repeticiones. */
export const dedupeSummaries = (summaries: Array<string | null>, limit = 3): string[] => {
  const counts = new Map<string, number>();
  for (const summary of summaries) {
    if (!summary) continue;
    counts.set(summary, (counts.get(summary) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([text, count]) => (count > 1 ? `${text} (×${count})` : text));
};

// ---------------------------------------------------------------------------
// Evaluación
// ---------------------------------------------------------------------------

const toView = (attempt: Attempt, now: Date): AttemptView => ({
  at: attempt.at,
  startedAt: attempt.startedAt,
  ageMinutes: ageInMinutes(attempt.at, now) ?? 0,
  kind: attempt.kind,
  outcome: attempt.outcome,
  read: attempt.read,
  created: attempt.created,
  modified: attempt.modified,
  cancelled: attempt.cancelled,
  failed: attempt.failed,
  noNewReservations:
    attempt.outcome === 'success' &&
    attempt.read > 0 &&
    attempt.created === 0 &&
    (attempt.modified ?? 0) === 0 &&
    attempt.cancelled === 0,
});

const describeChanges = (view: AttemptView): string => {
  if (view.noNewReservations) return 'No hay nuevas reservas';
  const parts = [`${view.created} nuevas`];
  if (view.modified !== null) parts.push(`${view.modified} modificadas`);
  parts.push(`${view.cancelled} canceladas`);
  return parts.join(', ');
};

export const describeAttemptResult = (view: AttemptView): string => {
  if (view.outcome === 'failed') return 'Ha fallado';
  if (view.outcome === 'no_data') return 'Terminó sin recibir ninguna reserva';
  if (view.outcome === 'partial') return `${view.failed} de ${view.read} con error · ${describeChanges(view)}`;
  return describeChanges(view);
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function evaluatePmsHealth(evidence: PmsEvidence): PmsHealth {
  const { now, integration } = evidence;
  const findings: Finding[] = [];

  const base = {
    integration,
    findings,
    lastAttempt: null as AttemptView | null,
    lastSuccess: null as AttemptView | null,
    overduePass: null as PmsHealth['overduePass'],
    frequencyKnown: evidence.schedule !== null,
    scheduleTimes: evidence.schedule ? [...evidence.schedule.times] : null,
    inFlight: null as InFlight | null,
    lastErrorSummaries: [] as string[],
    lastErrorAt: null as string | null,
    pendingLinks: null as PendingLinks | null,
    pendingLinksUnavailable: false,
    diagnosticReadFailed: false,
    ignoredAttempts: evidence.ignoredAttempts,
  };
  const done = (status: PmsHealthStatus, headline: string): PmsHealth => ({
    ...base,
    status,
    label: PMS_STATUS_LABEL[status],
    tone: PMS_STATUS_TONE[status],
    headline,
  });

  if (evidence.enabled === false) return done('disabled', 'Desactivada en la configuración.');

  if (evidence.attempts.state === 'error') {
    base.diagnosticReadFailed = true;
    return done('insufficient', 'No se pudo consultar el diagnóstico, así que no sabemos el estado real.');
  }

  // Incidencias de vinculación: se leen aparte y su fallo nunca deja el estado en verde.
  if (evidence.pendingLinks.state === 'ok') {
    base.pendingLinks = evidence.pendingLinks.data;
    if (evidence.pendingLinks.data.total > 0) {
      findings.push({
        code: 'pending_links',
        severity: 'warning',
        text: `${plural(evidence.pendingLinks.data.total, 'reserva', 'reservas')} sin propiedad vinculada: no crean limpieza.`,
      });
    }
    if (evidence.pendingLinks.data.incomplete) {
      findings.push({
        code: 'pending_links_incomplete',
        severity: 'warning',
        text: 'La lista de reservas sin vincular puede estar incompleta.',
      });
    }
  } else {
    base.pendingLinksUnavailable = true;
    findings.push({
      code: 'pending_links_unavailable',
      severity: 'warning',
      text:
        evidence.pendingLinks.state === 'unavailable'
          ? 'Sin información disponible sobre reservas sin vincular: elige una sede.'
          : 'No se pudo comprobar si hay reservas sin vincular.',
    });
  }

  if (evidence.ignoredAttempts > 0) {
    findings.push({
      code: 'ignored_simulations',
      severity: 'info',
      text: `${plural(evidence.ignoredAttempts, 'simulación reciente', 'simulaciones recientes')} no cuenta como importación.`,
    });
  }

  const attempts = [...evidence.attempts.data]
    .filter((attempt) => ageInMinutes(attempt.at, now) !== null)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const last = attempts[0] ?? null;
  const lastSuccess = attempts.find((attempt) => attempt.outcome === 'success') ?? null;
  base.lastAttempt = last ? toView(last, now) : null;
  base.lastSuccess = lastSuccess ? toView(lastSuccess, now) : null;

  // Último error registrado, aunque haya un éxito posterior.
  const lastFailing = attempts.find((attempt) => attempt.outcome === 'failed' || attempt.outcome === 'partial');
  if (lastFailing) {
    base.lastErrorSummaries = lastFailing.errorSummaries;
    base.lastErrorAt = lastFailing.at;
  }

  // Resultado del último intento: visible aunque una ejecución esté en curso.
  if (last?.outcome === 'failed') {
    findings.unshift({
      code: 'last_attempt_failed',
      severity: 'danger',
      text: `El último intento (${formatMadridStamp(last.at)}) ha fallado.`,
    });
  } else if (last?.outcome === 'partial') {
    findings.unshift({
      code: 'partial_failure',
      severity: 'warning',
      text: `El último intento (${formatMadridStamp(last.at)}) importó con errores: ${last.failed} de ${last.read}.`,
    });
  } else if (last?.outcome === 'no_data') {
    findings.unshift({
      code: 'no_data_read',
      severity: 'warning',
      text: `El último intento (${formatMadridStamp(last.at)}) terminó sin recibir ninguna reserva; no se puede confirmar que importe.`,
    });
  }

  // Marcas de ejecución en curso.
  let flight: InFlight | null = null;
  if (evidence.inFlight.state === 'ok') {
    flight =
      [...evidence.inFlight.data].sort((a, b) => new Date(a.since).getTime() - new Date(b.since).getTime())[0] ?? null;
  } else {
    findings.push({
      code: 'in_flight_unavailable',
      severity: 'warning',
      text: 'No se pudo comprobar si hay una ejecución en curso.',
    });
  }
  base.inFlight = flight;

  if (flight) {
    const minutes = ageInMinutes(flight.since, now) ?? 0;
    if (flight.phase === 'running' && minutes >= RUNNING_STUCK_MINUTES) {
      findings.push({
        code: 'stuck',
        severity: 'danger',
        text: `Una ejecución lleva ${minutes} min en curso: parece atascada.`,
      });
      return done('error', `Aparentemente atascada: en curso ${formatAge(minutes).replace('hace ', 'desde hace ')}.`);
    }
    if (flight.phase === 'queued' && minutes >= QUEUED_UNATTENDED_MINUTES) {
      findings.push({
        code: 'request_unattended',
        severity: 'warning',
        text: `Hay una petición manual esperando desde hace ${minutes} min sin que nadie la recoja.`,
      });
    } else if (flight.phase === 'running') {
      return done('running', `Se está ejecutando ahora (desde ${formatMadridStamp(flight.since)}).`);
    }
  }

  if (!last) {
    return done(
      'insufficient',
      'No hay ninguna ejecución registrada. No sabemos si no se ha ejecutado o si no podemos leer el historial.',
    );
  }

  // Frescura según la frecuencia esperada, solo si existe.
  if (evidence.schedule) {
    const expected = latestExpectedPass(now, evidence.schedule);
    if (expected) {
      const covered =
        new Date(last.at).getTime() >= expected.at.getTime() - SCHEDULE_EARLY_TOLERANCE_MINUTES * MINUTE;
      if (!covered) {
        base.overduePass = { label: expected.label, at: expected.at.toISOString() };
        findings.unshift({
          code: 'not_run',
          severity: 'warning',
          text: `No consta la pasada de las ${expected.label} (${formatMadridStamp(expected.at)}).`,
        });
      }
    }
  }

  const lastSuccessText = base.lastSuccess
    ? `Última importación correcta ${formatAge(base.lastSuccess.ageMinutes)}.`
    : 'No hay ninguna importación correcta registrada.';

  if (last.outcome === 'failed') {
    return done('error', `El último intento ha fallado (${formatAge(base.lastAttempt!.ageMinutes)}). ${lastSuccessText}`);
  }
  if (base.overduePass) {
    return done(
      'stale',
      `No se ha ejecutado la pasada de las ${base.overduePass.label}. ${lastSuccessText}`,
    );
  }
  if (last.outcome === 'partial') {
    return done('warnings', `Importó con errores (${formatAge(base.lastAttempt!.ageMinutes)}). ${lastSuccessText}`);
  }
  if (last.outcome === 'no_data') {
    return done('warnings', `El último intento no recibió reservas. ${lastSuccessText}`);
  }

  // Último intento correcto y, si hay horario, dentro de plazo.
  const success = base.lastAttempt!;
  if (!evidence.schedule) {
    findings.push({
      code: 'no_reference_frequency',
      severity: 'info',
      text: 'No hay una frecuencia esperada registrada, así que no se puede valorar si el dato es reciente.',
    });
    // Una incidencia real (p. ej. reservas sin vincular) pesa más que la falta de referencia.
    const actionable = findings.some((finding) => finding.severity !== 'info');
    return done(
      actionable ? 'warnings' : 'insufficient',
      `Último intento correcto ${formatAge(success.ageMinutes)}, pero sin frecuencia de referencia para valorarlo.`,
    );
  }

  const hasWarning = findings.some((finding) => finding.severity !== 'info');
  const result = success.noNewReservations ? 'No hay nuevas reservas.' : `${describeChanges(success)}.`;
  const headline = `Última importación correcta ${formatAge(success.ageMinutes)}. ${result}`;
  return done(hasWarning ? 'warnings' : 'up_to_date', headline);
}
