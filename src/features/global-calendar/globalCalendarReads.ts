/**
 * Lecturas del calendario global. Solo `select`: no hay escrituras, no se
 * llaman funciones ni PMS. RLS decide qué ve cada usuario.
 *
 * Cada fuente se lee por separado. Si una falla o llega truncada, se marca
 * como incompleta y el calendario muestra «Dato no disponible» en las
 * propiedades que podría afectar: nunca se convierte en «sin reservas».
 * No se piden nombres de huéspedes ni datos de contacto.
 */
import type { RawReservation, RawTask, ReservationSource } from './globalCalendarModel';

/** Forma mínima del cliente que usan las lecturas (permite probarlas sin red). */
export interface ReadOnlyDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

export const PAGE_SIZE = 1000;
export const MAX_PAGES = 10;

export type PagedRead<T> = { state: 'ok'; rows: T[]; truncated: boolean } | { state: 'error' };

/**
 * Lee por páginas estables (orden por id) hasta agotar la consulta o llegar
 * al máximo. Llegar al máximo con la última página llena se marca como truncado.
 */
export async function readPaged<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: () => any,
  signal?: AbortSignal,
): Promise<PagedRead<T>> {
  const rows: T[] = [];
  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      let query = build().order('id', { ascending: true }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query;
      if (error) return { state: 'error' };
      const batch = (data ?? []) as T[];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) return { state: 'ok', rows, truncated: false };
    }
    return { state: 'ok', rows, truncated: true };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { state: 'error' };
  }
}

export interface WeekRange {
  from: string;
  to: string;
}

// ---------------------------------------------------------------------------
// Limpiezas
// ---------------------------------------------------------------------------

export const TASK_SELECTION =
  'id, date, start_time, end_time, status, type, propiedad_id, property, cleaner, task_assignments(cleaner_id, cleaner_name), task_reports(cleaner_id, overall_status, start_time, end_time)';

/** Tareas de la sede en la semana. Las canceladas no son limpiezas previstas. */
export function readWeekTasks(db: ReadOnlyDb, sedeId: string, range: WeekRange, signal?: AbortSignal) {
  return readPaged<RawTask>(
    () =>
      db
        .from('tasks')
        .select(TASK_SELECTION)
        .eq('sede_id', sedeId)
        .gte('date', range.from)
        .lte('date', range.to)
        .neq('status', 'cancelled'),
    signal,
  );
}

// ---------------------------------------------------------------------------
// Edificios (grupos de propiedades)
// ---------------------------------------------------------------------------

export interface BuildingAssignmentRow {
  id: string;
  property_id: string;
  property_group_id: string;
  property_groups: { id: string; name: string | null; display_name: string | null; is_active: boolean | null } | null;
}

export function readBuildingAssignments(db: ReadOnlyDb, signal?: AbortSignal) {
  return readPaged<BuildingAssignmentRow>(
    () => db.from('property_group_assignments').select('id, property_id, property_group_id, property_groups(id, name, display_name, is_active)'),
    signal,
  );
}

/** Primer edificio activo de cada propiedad (por nombre), para agrupar filas. */
export function buildingByProperty(rows: BuildingAssignmentRow[]): Map<string, { id: string; name: string }> {
  const result = new Map<string, { id: string; name: string }>();
  const sorted = rows
    .filter((row) => row.property_groups && row.property_groups.is_active !== false)
    .map((row) => ({
      propertyId: row.property_id,
      id: row.property_group_id,
      name: (row.property_groups?.display_name || row.property_groups?.name || '').trim() || 'Edificio sin nombre',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }) || a.id.localeCompare(b.id));
  for (const row of sorted) if (!result.has(row.propertyId)) result.set(row.propertyId, { id: row.id, name: row.name });
  return result;
}

// ---------------------------------------------------------------------------
// Reservas de todas las fuentes
// ---------------------------------------------------------------------------

/** Propiedades a las que puede afectar una fuente no leída: todas o las de su mapeo. */
export type Affected = 'all' | string[];

export interface SourceCoverage {
  source: ReservationSource;
  state: 'ok' | 'error' | 'truncated';
  affected: Affected;
}

export interface UnmappedCount {
  source: ReservationSource;
  count: number;
}

export interface ReservationsRead {
  raws: RawReservation[];
  coverage: SourceCoverage[];
  /** Reservas activas que la fuente no vincula a ninguna propiedad (cualquier sede). */
  unmapped: UnmappedCount[];
}

const normalizeRoom = (value: string | null | undefined) =>
  (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const isStayService = (value: string | null | undefined) => {
  const normalized = normalizeRoom(value);
  return normalized.includes('stay') || normalized.includes('huesped') || normalized.includes('diaria');
};

const coverageOf = (source: ReservationSource, read: PagedRead<unknown>, affected: Affected): SourceCoverage => ({
  source,
  state: read.state === 'error' ? 'error' : read.truncated ? 'truncated' : 'ok',
  affected,
});

const isActiveStatus = (status: string | null | undefined) => !/cancel|no.?show|elimin|delet/i.test(status ?? '');

interface DirectRow {
  id: string;
  property_id: string | null;
  status: string | null;
  task_id?: string | null;
  cancellation_date?: string | null;
  external?: string | number | null;
  check_in: string | null;
  check_out: string | null;
}

export async function readWeekReservations(db: ReadOnlyDb, range: WeekRange, signal?: AbortSignal): Promise<ReservationsRead> {
  // Una estancia se ve en la semana si entra antes del domingo y sale el lunes o después.
  const overlapping = (table: string, select: string, checkInColumn: string, checkOutColumn: string) =>
    readPaged<Record<string, unknown>>(
      () => db.from(table).select(select).lte(checkInColumn, range.to).gte(checkOutColumn, range.from),
      signal,
    );

  const [portal, avantio, hostaway, smoobu, smoobuMappings, lh, lhMappings, avirato, aviratoMappings] = await Promise.all([
    overlapping('client_reservations', 'id, property_id, check_in_date, check_out_date, status, task_id', 'check_in_date', 'check_out_date'),
    overlapping(
      'avantio_reservations',
      'id, avantio_reservation_id, property_id, arrival_date, departure_date, status, task_id, cancellation_date',
      'arrival_date',
      'departure_date',
    ),
    overlapping(
      'hostaway_reservations',
      'id, hostaway_reservation_id, property_id, arrival_date, departure_date, status, task_id, cancellation_date',
      'arrival_date',
      'departure_date',
    ),
    overlapping('smoobu_reservations', 'id, external_id, property_id, check_in, check_out, status', 'check_in', 'check_out'),
    readPaged<{ id: string; property_id: string | null; is_active: boolean | null }>(
      () => db.from('smoobu_property_mappings').select('id, property_id, is_active'),
      signal,
    ),
    overlapping('lh_reservations', 'id, external_id, room, rooms, check_in, check_out, status', 'check_in', 'check_out'),
    readPaged<{ id: string; lh_room: string; service_kind: string | null; propiedad_id: string | null; is_active: boolean | null }>(
      () => db.from('lh_room_mapping').select('id, lh_room, service_kind, propiedad_id, is_active'),
      signal,
    ),
    overlapping(
      'avirato_reservations',
      'id, external_id, space_name, space_subtype_id, check_in, check_out, status, normalized_status',
      'check_in',
      'check_out',
    ),
    readPaged<{ id: string; space_subtype_id: number | null; service_kind: string | null; propiedad_id: string | null; is_active: boolean | null }>(
      () => db.from('avirato_room_mapping').select('id, space_subtype_id, service_kind, propiedad_id, is_active'),
      signal,
    ),
  ]);

  const raws: RawReservation[] = [];
  const unmapped: UnmappedCount[] = [];
  const coverage: SourceCoverage[] = [];
  const countUnmapped = (source: ReservationSource, count: number) => {
    if (count > 0) unmapped.push({ source, count });
  };

  // Fuentes con propiedad directa.
  const direct = (
    source: ReservationSource,
    read: PagedRead<Record<string, unknown>>,
    pick: (row: Record<string, unknown>) => DirectRow,
    affected: Affected,
  ) => {
    coverage.push(coverageOf(source, read, affected));
    if (read.state !== 'ok') return;
    let missing = 0;
    for (const raw of read.rows) {
      const row = pick(raw);
      if (!row.property_id) {
        if (isActiveStatus(row.status) && !row.cancellation_date) missing += 1;
        continue;
      }
      raws.push({
        source,
        sourceId: String(row.id),
        externalId: row.external == null ? null : String(row.external),
        propertyId: row.property_id,
        checkIn: row.check_in,
        checkOut: row.check_out,
        status: row.status,
        taskId: row.task_id ?? null,
        cancelledAt: row.cancellation_date ?? null,
      });
    }
    countUnmapped(source, missing);
  };
  const text = (value: unknown) => (value == null ? null : String(value));

  direct('portal', portal, (row) => ({
    id: String(row.id), property_id: text(row.property_id), status: text(row.status), task_id: text(row.task_id),
    check_in: text(row.check_in_date), check_out: text(row.check_out_date),
  }), 'all');
  direct('avantio', avantio, (row) => ({
    id: String(row.id), property_id: text(row.property_id), status: text(row.status), task_id: text(row.task_id),
    cancellation_date: text(row.cancellation_date), external: text(row.avantio_reservation_id),
    check_in: text(row.arrival_date), check_out: text(row.departure_date),
  }), 'all');
  direct('hostaway', hostaway, (row) => ({
    id: String(row.id), property_id: text(row.property_id), status: text(row.status), task_id: text(row.task_id),
    cancellation_date: text(row.cancellation_date), external: text(row.hostaway_reservation_id),
    check_in: text(row.arrival_date), check_out: text(row.departure_date),
  }), 'all');
  const smoobuAffected: Affected = smoobuMappings.state === 'ok'
    ? [...new Set(smoobuMappings.rows.map((row) => row.property_id).filter((id): id is string => !!id))]
    : 'all';
  direct('smoobu', smoobu, (row) => ({
    id: String(row.id), property_id: text(row.property_id), status: text(row.status), external: text(row.external_id),
    check_in: text(row.check_in), check_out: text(row.check_out),
  }), smoobuAffected);

  // Little Hotelier: cada habitación se traduce a propiedad con su mapeo de salida.
  const lhCheckoutMappings = lhMappings.state === 'ok'
    ? lhMappings.rows.filter((row) => row.is_active !== false && row.propiedad_id && !isStayService(row.service_kind))
    : [];
  const lhRooms = new Map(lhCheckoutMappings.map((row) => [normalizeRoom(row.lh_room), row.propiedad_id as string]));
  const lhAffected: Affected = lhMappings.state === 'ok' ? [...new Set(lhRooms.values())] : 'all';
  if (lh.state === 'ok' && lhMappings.state !== 'ok') {
    coverage.push({ source: 'littleHotelier', state: 'error', affected: 'all' });
  } else {
    coverage.push(coverageOf('littleHotelier', lh, lhAffected));
  }
  if (lh.state === 'ok' && lhMappings.state === 'ok') {
    let missing = 0;
    for (const row of lh.rows) {
      const listed = Array.isArray(row.rooms) ? (row.rooms as unknown[]).map((room) => text(room)).filter((room): room is string => !!room) : [];
      const rooms = listed.length ? listed : [text(row.room)].filter((room): room is string => !!room);
      const status = text(row.status);
      const properties = new Map<string, string>();
      for (const room of rooms) {
        const propertyId = lhRooms.get(normalizeRoom(room));
        if (propertyId && !properties.has(propertyId)) properties.set(propertyId, room);
      }
      if (!properties.size && isActiveStatus(status)) missing += 1;
      for (const [propertyId, room] of properties) {
        raws.push({
          source: 'littleHotelier',
          sourceId: String(row.id),
          externalId: text(row.external_id),
          propertyId,
          checkIn: text(row.check_in),
          checkOut: text(row.check_out),
          status,
          room,
        });
      }
    }
    countUnmapped('littleHotelier', missing);
  }

  // Avirato: el tipo de espacio se traduce a propiedad con su mapeo de salida.
  const aviratoCheckoutMappings = aviratoMappings.state === 'ok'
    ? aviratoMappings.rows.filter((row) => row.is_active !== false && row.propiedad_id && row.space_subtype_id != null && !isStayService(row.service_kind))
    : [];
  const aviratoSubtypes = new Map(aviratoCheckoutMappings.map((row) => [String(row.space_subtype_id), row.propiedad_id as string]));
  const aviratoAffected: Affected = aviratoMappings.state === 'ok' ? [...new Set(aviratoSubtypes.values())] : 'all';
  if (avirato.state === 'ok' && aviratoMappings.state !== 'ok') {
    coverage.push({ source: 'avirato', state: 'error', affected: 'all' });
  } else {
    coverage.push(coverageOf('avirato', avirato, aviratoAffected));
  }
  if (avirato.state === 'ok' && aviratoMappings.state === 'ok') {
    let missing = 0;
    for (const row of avirato.rows) {
      const status = text(row.normalized_status) ?? text(row.status);
      const propertyId = row.space_subtype_id == null ? undefined : aviratoSubtypes.get(String(row.space_subtype_id));
      if (!propertyId) {
        if (isActiveStatus(status)) missing += 1;
        continue;
      }
      raws.push({
        source: 'avirato',
        sourceId: String(row.id),
        externalId: text(row.external_id),
        propertyId,
        checkIn: text(row.check_in),
        checkOut: text(row.check_out),
        status,
        room: text(row.space_name),
      });
    }
    countUnmapped('avirato', missing);
  }

  return { raws, coverage, unmapped };
}

/** Indica si las reservas de una propiedad pueden estar incompletas por una fuente no leída. */
export function incompleteChecker(coverage: SourceCoverage[]): (propertyId: string) => boolean {
  const failing = coverage.filter((item) => item.state !== 'ok');
  if (failing.some((item) => item.affected === 'all')) return () => true;
  const affected = new Set(failing.flatMap((item) => item.affected as string[]));
  return (propertyId) => affected.has(propertyId);
}
