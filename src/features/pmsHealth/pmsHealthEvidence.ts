/**
 * Convierte las filas que ya guarda cada PMS en la evidencia que entiende el
 * panel. Es puro: no consulta nada y no conoce el cliente de base de datos.
 *
 * Fuentes reales (solo lectura):
 *  - Smoobu: `smoobu_sync_runs` (una fila por pasada terminada) y
 *    `smoobu_sync_requests` (peticiones manuales con su estado).
 *  - Little Hotelier: `lh_sync_logs` (una fila por reserva recibida; las filas
 *    cercanas en el tiempo forman una pasada).
 */
import {
  type Attempt,
  type EvidenceSource,
  type ExpectedSchedule,
  type InFlight,
  type PendingLinks,
  type PmsEvidence,
  dedupeSummaries,
  safeErrorSummary,
} from './pmsHealthDomain';

/** Horas de las pasadas de Smoobu (las mismas que declara la pantalla de Smoobu). */
export const SMOOBU_SCHEDULE: ExpectedSchedule = {
  times: ['08:00', '15:00', '19:00'],
  graceMinutes: 30,
};

/**
 * Little Hotelier no declara su horario en ningún sitio de la aplicación: la
 * pasada se ejecuta en un equipo local. Sin frecuencia fiable, el panel muestra
 * la antigüedad pero no afirma ningún incumplimiento. Declarar aquí las horas
 * cuando estén confirmadas.
 */
export const LITTLE_HOTELIER_SCHEDULE: ExpectedSchedule | null = null;

/** Filas separadas por más de esto pertenecen a pasadas distintas (igual que el historial existente). */
export const LH_PASS_GAP_MS = 10 * 60 * 1000;
/** Una pasada con registros de hace menos de esto se considera todavía recibiendo datos. */
export const LH_RECEIVING_MS = 5 * 60 * 1000;

const MAX_PENDING_ROWS = 1000;

export interface SmoobuRunRow {
  id: string;
  cuando: string;
  disparo: string | null;
  modo: string | null;
  reservas: number | null;
  altas: number | null;
  actualizaciones: number | null;
  sin_cambios: number | null;
  canceladas: number | null;
  errores: number | null;
  sin_mapear: number | null;
  detalle: Array<{ ok?: boolean; respuesta?: string }> | null;
}

export interface SmoobuRequestRow {
  id: string;
  pedida_at: string;
  estado: string | null;
  completada_at: string | null;
}

export interface LhLogRow {
  id: string;
  success: boolean | null;
  status_code: number | null;
  error_message: string | null;
  created_at: string;
  result: { reservation_created?: boolean; cancelled?: boolean } | null;
}

const num = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const isRealMode = (mode: string | null) => (mode ?? '').toLowerCase() === 'real';

const kindOf = (trigger: string | null): Attempt['kind'] => {
  const value = (trigger ?? '').toLowerCase();
  if (value === 'manual') return 'manual';
  if (/auto|program|sched|cron|tarea|timer/.test(value)) return 'scheduled';
  return 'unknown';
};

// ---------------------------------------------------------------------------
// Smoobu
// ---------------------------------------------------------------------------

export function smoobuAttempts(
  runs: SmoobuRunRow[],
  requests: SmoobuRequestRow[],
): { attempts: Attempt[]; ignoredSimulations: number } {
  const attempts: Attempt[] = [];
  let ignoredSimulations = 0;

  for (const run of runs) {
    // Una simulación no importa nada: no cuenta ni como éxito ni como fallo.
    if (!isRealMode(run.modo)) {
      ignoredSimulations += 1;
      continue;
    }
    const read = num(run.reservas);
    const failed = num(run.errores);
    const outcome: Attempt['outcome'] =
      failed > 0 ? (failed >= read ? 'failed' : 'partial') : read > 0 ? 'success' : 'no_data';
    const messages = (run.detalle ?? [])
      .filter((entry) => entry && entry.ok === false)
      .map((entry) => safeErrorSummary(entry.respuesta));
    attempts.push({
      at: run.cuando,
      startedAt: null,
      kind: kindOf(run.disparo),
      outcome,
      read,
      created: num(run.altas),
      modified: num(run.actualizaciones),
      cancelled: num(run.canceladas),
      failed,
      errorSummaries: failed > 0 ? dedupeSummaries(messages) : [],
    });
  }

  // Una petición manual que terminó en error puede no haber dejado fila de pasada.
  for (const request of requests) {
    if ((request.estado ?? '').toLowerCase() !== 'error') continue;
    attempts.push({
      at: request.completada_at ?? request.pedida_at,
      startedAt: request.pedida_at,
      kind: 'manual',
      outcome: 'failed',
      read: 0,
      created: 0,
      modified: 0,
      cancelled: 0,
      failed: 1,
      errorSummaries: ['La petición manual terminó con error.'],
    });
  }

  return { attempts, ignoredSimulations };
}

export function smoobuInFlight(requests: SmoobuRequestRow[]): InFlight[] {
  const flights: InFlight[] = [];
  for (const request of requests) {
    const state = (request.estado ?? '').toLowerCase();
    if (state === 'pendiente') flights.push({ phase: 'queued', since: request.pedida_at });
    else if (state === 'en_curso') flights.push({ phase: 'running', since: request.pedida_at });
  }
  return flights;
}

const NOT_CANCELLED = (status: string | null) => !/^cancel+ed$|^cancelada$/i.test((status ?? '').trim());

export function smoobuPendingLinks(
  reservations: Array<{ property_name: string | null; status: string | null }>,
  mappings: Array<{ smoobu_property_name: string; is_active: boolean }>,
): PendingLinks {
  const mapped = new Set(mappings.filter((m) => m.is_active).map((m) => m.smoobu_property_name));
  const byName = new Map<string, number>();
  let total = 0;
  for (const reservation of reservations) {
    const name = reservation.property_name?.trim();
    if (!name || mapped.has(name) || !NOT_CANCELLED(reservation.status)) continue;
    byName.set(name, (byName.get(name) ?? 0) + 1);
    total += 1;
  }
  return {
    total,
    items: [...byName.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    incomplete: reservations.length >= MAX_PENDING_ROWS,
  };
}

// ---------------------------------------------------------------------------
// Little Hotelier
// ---------------------------------------------------------------------------

const logFailed = (log: LhLogRow) => log.success === false || num(log.status_code) >= 400 || Boolean(log.error_message);

export function lhAttempts(logs: LhLogRow[], now: Date): { attempts: Attempt[]; inFlight: InFlight[] } {
  const valid = logs
    .map((log) => ({ log, time: new Date(log.created_at).getTime() }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((a, b) => a.time - b.time);

  const groups: Array<{ first: number; last: number; rows: LhLogRow[] }> = [];
  for (const entry of valid) {
    const group = groups[groups.length - 1];
    if (group && entry.time - group.last <= LH_PASS_GAP_MS) {
      group.last = entry.time;
      group.rows.push(entry.log);
    } else {
      groups.push({ first: entry.time, last: entry.time, rows: [entry.log] });
    }
  }

  const attempts: Attempt[] = groups.map((group) => {
    const failedRows = group.rows.filter(logFailed);
    const failed = failedRows.length;
    const outcome: Attempt['outcome'] = failed === 0 ? 'success' : failed >= group.rows.length ? 'failed' : 'partial';
    return {
      at: new Date(group.last).toISOString(),
      startedAt: new Date(group.first).toISOString(),
      kind: 'unknown',
      outcome,
      read: group.rows.length,
      created: group.rows.filter((row) => row.result?.reservation_created).length,
      // Las filas no distinguen una reserva modificada de una sin cambios.
      modified: null,
      cancelled: group.rows.filter((row) => row.result?.cancelled).length,
      failed,
      errorSummaries: dedupeSummaries(failedRows.map((row) => safeErrorSummary(row.error_message, row.status_code))),
    };
  });

  const latest = groups[groups.length - 1];
  const inFlight: InFlight[] =
    latest && now.getTime() - latest.last < LH_RECEIVING_MS
      ? [{ phase: 'running', since: new Date(latest.first).toISOString() }]
      : [];
  return { attempts, inFlight };
}

export interface LhReservationRow {
  id: string;
  room: string | null;
  rooms: string[] | null;
  status: string | null;
  needs_room_assignment: boolean | null;
}

export function lhPendingLinks(
  reservations: LhReservationRow[],
  mappings: Array<{ lh_room: string; is_active: boolean }>,
): PendingLinks {
  const mappedRooms = new Set(mappings.filter((m) => m.is_active).map((m) => m.lh_room.trim()));
  const byRoom = new Map<string, Set<string>>();
  const unassigned = new Set<string>();
  const affected = new Set<string>();
  for (const reservation of reservations) {
    if (!NOT_CANCELLED(reservation.status)) continue;
    if (reservation.needs_room_assignment) {
      unassigned.add(reservation.id);
      affected.add(reservation.id);
      continue;
    }
    const rooms = (reservation.rooms?.length ? reservation.rooms : [reservation.room ?? ''])
      .map((room) => room.trim())
      .filter((room) => room && room !== '-');
    for (const room of rooms) {
      if (mappedRooms.has(room)) continue;
      const set = byRoom.get(room) ?? new Set<string>();
      set.add(reservation.id);
      byRoom.set(room, set);
      affected.add(reservation.id);
    }
  }
  const items = [...byRoom.entries()]
    .map(([room, ids]) => ({ label: `Habitación «${room}» sin propiedad`, count: ids.size }))
    .sort((a, b) => b.count - a.count);
  if (unassigned.size > 0) items.push({ label: 'Reservas sin habitación asignada', count: unassigned.size });
  return { total: affected.size, items, incomplete: reservations.length >= MAX_PENDING_ROWS };
}

// ---------------------------------------------------------------------------
// Ensamblado
// ---------------------------------------------------------------------------

type RawSource<T> = EvidenceSource<T>;

export interface SmoobuRaw {
  runs: RawSource<SmoobuRunRow[]>;
  requests: RawSource<SmoobuRequestRow[]>;
  pending: RawSource<{
    reservations: Array<{ property_name: string | null; status: string | null }>;
    mappings: Array<{ smoobu_property_name: string; is_active: boolean }>;
  }>;
}

export interface LhRaw {
  logs: RawSource<LhLogRow[]>;
  /** unavailable cuando no hay una sede activa que acote la consulta. */
  pending: RawSource<{
    reservations: LhReservationRow[];
    mappings: Array<{ lh_room: string; is_active: boolean }>;
  }> | { state: 'unavailable' };
}

export function buildSmoobuEvidence(raw: SmoobuRaw, now: Date): PmsEvidence {
  const requests = raw.requests.state === 'ok' ? raw.requests.data : [];
  const derived = raw.runs.state === 'ok' ? smoobuAttempts(raw.runs.data, requests) : null;
  return {
    integration: 'smoobu',
    now,
    enabled: null,
    attempts:
      raw.runs.state === 'ok' && derived
        ? { state: 'ok', data: derived.attempts }
        : { state: 'error' },
    inFlight: raw.requests.state === 'ok' ? { state: 'ok', data: smoobuInFlight(raw.requests.data) } : { state: 'error' },
    schedule: SMOOBU_SCHEDULE,
    pendingLinks:
      raw.pending.state === 'ok'
        ? { state: 'ok', data: smoobuPendingLinks(raw.pending.data.reservations, raw.pending.data.mappings) }
        : { state: 'error' },
    ignoredAttempts: derived?.ignoredSimulations ?? 0,
  };
}

export function buildLhEvidence(raw: LhRaw, now: Date): PmsEvidence {
  const derived = raw.logs.state === 'ok' ? lhAttempts(raw.logs.data, now) : null;
  let pendingLinks: PmsEvidence['pendingLinks'];
  if (raw.pending.state === 'ok') {
    pendingLinks = { state: 'ok', data: lhPendingLinks(raw.pending.data.reservations, raw.pending.data.mappings) };
  } else {
    pendingLinks = raw.pending.state === 'unavailable' ? { state: 'unavailable' } : { state: 'error' };
  }
  return {
    integration: 'little_hotelier',
    now,
    enabled: null,
    attempts: derived ? { state: 'ok', data: derived.attempts } : { state: 'error' },
    // Sin registros no hay forma de saber si hay una pasada en curso: se deduce de los propios registros.
    inFlight: derived ? { state: 'ok', data: derived.inFlight } : { state: 'error' },
    schedule: LITTLE_HOTELIER_SCHEDULE,
    pendingLinks,
    ignoredAttempts: 0,
  };
}
