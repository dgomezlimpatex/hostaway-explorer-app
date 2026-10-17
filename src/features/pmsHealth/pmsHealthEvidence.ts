/**
 * Convierte las filas que ya guarda cada PMS en la evidencia que entiende el
 * panel. Es puro: no consulta nada y no conoce el cliente de base de datos.
 *
 * Fuentes reales (solo lectura):
 *  - Smoobu: `smoobu_sync_runs` (una fila por pasada terminada) y
 *    `smoobu_sync_requests` (peticiones manuales con su estado).
 *  - Little Hotelier: `lh_sync_logs` (eventos por reserva recibida; las filas
 *    cercanas en el tiempo forman una pasada). No hay registro por pasada:
 *    el inicio, el fin, las pasadas con cero reservas y los fallos previos al
 *    envío solo existen en el equipo local.
 */
import {
  type Attempt,
  type EvidenceSource,
  type ExpectedSchedule,
  type InFlight,
  type LinkIssue,
  type PendingLinks,
  type PmsEvidence,
  dedupeSummaries,
  isNearExpectedPass,
  safeErrorSummary,
} from './pmsHealthDomain';

/** Horas de las pasadas de Smoobu (las mismas que declara la pantalla de Smoobu). */
export const SMOOBU_SCHEDULE: ExpectedSchedule = {
  times: ['08:00', '15:00', '19:00'],
  graceMinutes: 30,
};

/**
 * Horario de la automatización local de Little Hotelier, declarado por Dani
 * (11/10/2026 en adelante: 09:00, 14:00 y 20:00 de Madrid). La app no puede
 * comprobar que la automatización siga activa: es la hora ESPERADA, no una
 * prueba de ejecución. El margen cubre el límite de 330 s del ejecutor y un
 * inicio de sesión visible, para no avisar de noche ni por retrasos normales.
 */
export const LITTLE_HOTELIER_SCHEDULE: ExpectedSchedule = {
  times: ['09:00', '14:00', '20:00'],
  graceMinutes: 30,
};

/** Una pasada que empieza más allá de esta ventana respecto a todas las horas esperadas parece manual. */
export const LH_OFF_SCHEDULE_BEFORE_MIN = 15;
export const LH_OFF_SCHEDULE_AFTER_MIN = 60;

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

const NOT_CANCELLED = (status: string | null) => !/^cancel+ed$|^cancelada$/i.test((status ?? '').trim());

const byCountThenLabel = (a: LinkIssue, b: LinkIssue) => b.count - a.count || a.label.localeCompare(b.label, 'es');

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
    // Un alojamiento sin mapeo no tiene propiedad y, por tanto, tampoco sede.
    unattributed: [...byName.entries()]
      .map(([label, count]): LinkIssue => ({ kind: 'property_unmapped', label, count }))
      .sort(byCountThenLabel),
    unattributedTotal: total,
    sede: { state: 'not_applicable' },
    incomplete: reservations.length >= MAX_PENDING_ROWS,
  };
}

// ---------------------------------------------------------------------------
// Little Hotelier
// ---------------------------------------------------------------------------

const logFailed = (log: LhLogRow) => log.success === false || num(log.status_code) >= 400 || Boolean(log.error_message);

export function lhAttempts(
  logs: LhLogRow[],
  now: Date,
  schedule: ExpectedSchedule | null = LITTLE_HOTELIER_SCHEDULE,
): { attempts: Attempt[]; inFlight: InFlight[] } {
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
    // Ninguna fuente dice si una pasada fue manual: solo se infiere cuando empieza claramente fuera de horario.
    const offSchedule =
      schedule !== null &&
      !isNearExpectedPass(new Date(group.first), schedule, LH_OFF_SCHEDULE_BEFORE_MIN, LH_OFF_SCHEDULE_AFTER_MIN);
    return {
      at: new Date(group.last).toISOString(),
      startedAt: new Date(group.first).toISOString(),
      kind: offSchedule ? 'off_schedule' : 'unknown',
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

export interface LhMappingRow {
  lh_room: string;
  service_kind: string;
  is_active: boolean;
  sede_id: string;
  propiedad_id: string;
}

export interface PropertySedeRow {
  id: string;
  sede_id: string | null;
}

export interface ActiveSede {
  id: string;
  nombre: string | null;
}

const roomsOf = (reservation: LhReservationRow): string[] =>
  reservation.needs_room_assignment
    ? []
    : (reservation.rooms?.length ? reservation.rooms : [reservation.room ?? ''])
        .map((room) => (room ?? '').trim())
        .filter((room) => room && room !== '-');

/**
 * Separa las incidencias de vinculación de Little Hotelier.
 *
 * La sede NO se toma de `lh_reservations.sede_id` (el receptor antiguo la rellenaba con la
 * del primer mapeo que encontraba): se deduce del mapeo de la habitación, y de la sede de
 * su propiedad para detectar incoherencias. Lo que no tiene mapeo no pertenece a ninguna sede.
 *
 * - Sin habitación identificada y habitación sin propiedad: impiden crear limpieza.
 * - Falta de mapeo de salida o de estancia: ningún dato de la configuración indica qué
 *   servicios necesita cada habitación, así que se muestra como «Configuración por revisar».
 */
export function lhPendingLinks(
  reservations: LhReservationRow[],
  mappings: LhMappingRow[],
  properties: PropertySedeRow[],
  sede: ActiveSede | null,
): PendingLinks {
  const mappingsByRoom = new Map<string, LhMappingRow[]>();
  for (const mapping of mappings) {
    const room = mapping.lh_room.trim();
    mappingsByRoom.set(room, [...(mappingsByRoom.get(room) ?? []), mapping]);
  }
  const propertySede = new Map(properties.map((property) => [property.id, property.sede_id]));

  const withoutRoom = new Set<string>();
  const reservationsByRoom = new Map<string, Set<string>>();
  for (const reservation of reservations) {
    if (!NOT_CANCELLED(reservation.status)) continue;
    const rooms = roomsOf(reservation);
    if (rooms.length === 0) {
      withoutRoom.add(reservation.id);
      continue;
    }
    for (const room of rooms) {
      const ids = reservationsByRoom.get(room) ?? new Set<string>();
      ids.add(reservation.id);
      reservationsByRoom.set(room, ids);
    }
  }

  const unattributed: LinkIssue[] = [];
  const unattributedIds = new Set(withoutRoom);
  if (withoutRoom.size > 0) {
    unattributed.push({ kind: 'no_room', label: 'Reservas sin habitación identificada', count: withoutRoom.size });
  }

  const sedes = new Map<string, { blocking: LinkIssue[]; review: LinkIssue[] }>();
  const bucket = (id: string) => {
    const existing = sedes.get(id);
    if (existing) return existing;
    const created = { blocking: [] as LinkIssue[], review: [] as LinkIssue[] };
    sedes.set(id, created);
    return created;
  };

  for (const [room, ids] of reservationsByRoom) {
    const count = ids.size;
    const roomMappings = mappingsByRoom.get(room) ?? [];
    if (roomMappings.length === 0) {
      unattributed.push({ kind: 'room_unlinked', label: `Habitación «${room}» sin propiedad vinculada`, count });
      ids.forEach((id) => unattributedIds.add(id));
      continue;
    }
    const active = roomMappings.filter((mapping) => mapping.is_active);
    if (active.length === 0) {
      for (const sedeId of new Set(roomMappings.map((mapping) => mapping.sede_id))) {
        bucket(sedeId).blocking.push({
          kind: 'room_unlinked',
          label: `Habitación «${room}» sin propiedad vinculada (mapeo pausado)`,
          count,
        });
      }
      continue;
    }
    const kinds = new Set(active.map((mapping) => mapping.service_kind));
    for (const sedeId of new Set(active.map((mapping) => mapping.sede_id))) {
      if (!kinds.has('checkout')) {
        bucket(sedeId).review.push({
          kind: 'checkout_missing',
          label: `Habitación «${room}»: mapeo de salida pendiente (solo tiene estancia)`,
          count,
        });
      }
      if (!kinds.has('stay')) {
        bucket(sedeId).review.push({
          kind: 'stay_missing',
          label: `Habitación «${room}»: mapeo de estancia pendiente (solo tiene salida)`,
          count,
        });
      }
    }
    const mismatched = new Set<string>();
    for (const mapping of active) {
      const owner = propertySede.get(mapping.propiedad_id);
      if (owner && owner !== mapping.sede_id) {
        mismatched.add(mapping.sede_id);
        mismatched.add(owner);
      }
    }
    for (const sedeId of mismatched) {
      bucket(sedeId).review.push({
        kind: 'sede_mismatch',
        label: `Habitación «${room}»: la sede del mapeo no coincide con la de su propiedad`,
        count,
      });
    }
  }

  let sedeScope: PendingLinks['sede'] = { state: 'no_active_sede' };
  if (sede) {
    const own = sedes.get(sede.id) ?? { blocking: [], review: [] };
    sedeScope = {
      state: 'ok',
      sedeName: sede.nombre,
      blocking: [...own.blocking].sort(byCountThenLabel),
      review: [...own.review].sort(byCountThenLabel),
    };
  }

  return {
    unattributed: unattributed.sort(byCountThenLabel),
    unattributedTotal: unattributedIds.size,
    sede: sedeScope,
    incomplete: reservations.length >= MAX_PENDING_ROWS,
  };
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
  pending: RawSource<{
    reservations: LhReservationRow[];
    mappings: LhMappingRow[];
    properties: PropertySedeRow[];
  }>;
}

export function buildSmoobuEvidence(raw: SmoobuRaw, now: Date): PmsEvidence {
  const requests = raw.requests.state === 'ok' ? raw.requests.data : [];
  const derived = raw.runs.state === 'ok' ? smoobuAttempts(raw.runs.data, requests) : null;
  return {
    integration: 'smoobu',
    now,
    enabled: null,
    attempts: derived ? { state: 'ok', data: derived.attempts } : { state: 'error' },
    inFlight: raw.requests.state === 'ok' ? { state: 'ok', data: smoobuInFlight(raw.requests.data) } : { state: 'error' },
    schedule: SMOOBU_SCHEDULE,
    scheduleBasis: 'execution',
    executionRecorded: true,
    pendingLinks:
      raw.pending.state === 'ok'
        ? { state: 'ok', data: smoobuPendingLinks(raw.pending.data.reservations, raw.pending.data.mappings) }
        : { state: 'error' },
    ignoredAttempts: derived?.ignoredSimulations ?? 0,
  };
}

export function buildLhEvidence(raw: LhRaw, now: Date, sede: ActiveSede | null): PmsEvidence {
  const derived = raw.logs.state === 'ok' ? lhAttempts(raw.logs.data, now) : null;
  return {
    integration: 'little_hotelier',
    now,
    // Ninguna fuente consultable confirma si la automatización local está activa.
    enabled: null,
    attempts: derived ? { state: 'ok', data: derived.attempts } : { state: 'error' },
    // Sin registro por pasada, «recibiendo datos» se deduce de los propios eventos recientes.
    inFlight: derived ? { state: 'ok', data: derived.inFlight } : { state: 'error' },
    schedule: LITTLE_HOTELIER_SCHEDULE,
    scheduleBasis: 'received_data',
    executionRecorded: false,
    pendingLinks:
      raw.pending.state === 'ok'
        ? {
            state: 'ok',
            data: lhPendingLinks(raw.pending.data.reservations, raw.pending.data.mappings, raw.pending.data.properties, sede),
          }
        : { state: 'error' },
    ignoredAttempts: 0,
  };
}
