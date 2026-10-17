/**
 * Lecturas del panel de salud de PMS. Solo `select`: no hay escrituras, no se
 * invocan funciones y no se llama a ningún PMS.
 *
 * Reutilizan las mismas tablas y los mismos permisos que las pantallas de
 * Smoobu y Little Hotelier (RLS decide qué ve cada usuario). Si una consulta
 * falla, la fuente queda como `error`: nunca se convierte en «sin datos».
 *
 * Los campos se piden por nombre. No se leen `payload` ni nombres de huéspedes.
 */
import type { EvidenceSource } from './pmsHealthDomain';
import type {
  LhLogRow,
  LhRaw,
  LhMappingRow,
  LhReservationRow,
  PropertySedeRow,
  SmoobuRaw,
  SmoobuRequestRow,
  SmoobuRunRow,
} from './pmsHealthEvidence';

/** Forma mínima del cliente que usan las lecturas (permite probarlas sin red). */
export interface ReadOnlyDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

export const SMOOBU_RUNS_LIMIT = 30;
export const SMOOBU_REQUESTS_LIMIT = 10;
export const LH_LOGS_LIMIT = 400;
export const PENDING_ROWS_LIMIT = 1000;

async function guarded<T>(read: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<EvidenceSource<T>> {
  try {
    const { data, error } = await read();
    if (error) return { state: 'error' };
    return { state: 'ok', data: (data ?? []) as T };
  } catch {
    return { state: 'error' };
  }
}

export async function readSmoobuRaw(db: ReadOnlyDb, today: string): Promise<SmoobuRaw> {
  const [runs, requests, reservations, mappings] = await Promise.all([
    guarded<SmoobuRunRow[]>(() =>
      db
        .from('smoobu_sync_runs')
        .select(
          'id, cuando, disparo, modo, reservas, altas, actualizaciones, sin_cambios, canceladas, errores, sin_mapear, detalle',
        )
        .order('cuando', { ascending: false })
        .limit(SMOOBU_RUNS_LIMIT),
    ),
    guarded<SmoobuRequestRow[]>(() =>
      db
        .from('smoobu_sync_requests')
        .select('id, pedida_at, estado, completada_at')
        .order('pedida_at', { ascending: false })
        .limit(SMOOBU_REQUESTS_LIMIT),
    ),
    guarded<Array<{ property_name: string | null; status: string | null }>>(() =>
      db
        .from('smoobu_reservations')
        .select('property_name, status')
        .gte('check_out', today)
        .limit(PENDING_ROWS_LIMIT),
    ),
    guarded<Array<{ smoobu_property_name: string; is_active: boolean }>>(() =>
      db.from('smoobu_property_mappings').select('smoobu_property_name, is_active'),
    ),
  ]);

  let pending: SmoobuRaw['pending'] = { state: 'error' };
  if (reservations.state === 'ok' && mappings.state === 'ok') {
    pending = { state: 'ok', data: { reservations: reservations.data, mappings: mappings.data } };
  }
  return { runs, requests, pending };
}

export async function readLhRaw(db: ReadOnlyDb, today: string): Promise<LhRaw> {
  const [logs, reservations, mappings] = await Promise.all([
    guarded<LhLogRow[]>(() =>
      db
        .from('lh_sync_logs')
        .select('id, success, status_code, error_message, created_at, result')
        .order('created_at', { ascending: false })
        .limit(LH_LOGS_LIMIT),
    ),
    // La sede se deduce del mapeo de cada habitación, no de la columna sede_id de la reserva.
    guarded<LhReservationRow[]>(() =>
      db
        .from('lh_reservations')
        .select('id, room, rooms, status, needs_room_assignment')
        .gte('check_out', today)
        .limit(PENDING_ROWS_LIMIT),
    ),
    guarded<LhMappingRow[]>(() =>
      db.from('lh_room_mapping').select('lh_room, service_kind, is_active, sede_id, propiedad_id'),
    ),
  ]);

  let pending: LhRaw['pending'] = { state: 'error' };
  if (reservations.state === 'ok' && mappings.state === 'ok') {
    const propertyIds = [...new Set(mappings.data.map((mapping) => mapping.propiedad_id).filter(Boolean))];
    const properties: EvidenceSource<PropertySedeRow[]> =
      propertyIds.length === 0
        ? { state: 'ok', data: [] }
        : await guarded<PropertySedeRow[]>(() => db.from('properties').select('id, sede_id').in('id', propertyIds));
    if (properties.state === 'ok') {
      pending = { state: 'ok', data: { reservations: reservations.data, mappings: mappings.data, properties: properties.data } };
    }
  }
  return { logs, pending };
}
