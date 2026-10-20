// Lectura en lote del nombre de la destinataria de los envíos por comprobar.
// Dos consultas como máximo por lote (eventos y fichas que falten), con columnas
// mínimas explícitas: nunca teléfonos, PIN, DNI ni el snapshot JSON del aviso.
// El alcance lo deciden las políticas existentes del usuario de la app.
import { useQuery } from '@tanstack/react-query';
import { fromUntypedTable } from '@/lib/supabaseUntyped';
import {
  resolveRecipientNames,
  workerIdsToLookup,
  type CleanerNameRow,
  type RecipientEventRow,
  type RecipientLookup,
} from './whatsappMonitorModel';

export const RECIPIENT_EVENT_COLUMNS = 'id,cleaner_id,recipient_worker_id,recipient_name_snapshot';
export const CLEANER_NAME_COLUMNS = 'id,name';
const CHUNK = 100;

async function selectIn<T>(table: string, columns: string, ids: string[]): Promise<T[]> {
  const rows: T[] = [];
  for (let index = 0; index < ids.length; index += CHUNK) {
    const { data, error } = await fromUntypedTable(table).select(columns).in('id', ids.slice(index, index + CHUNK));
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as T[]));
  }
  return rows;
}

export async function fetchRecipientNames(eventIds: string[]) {
  const ids = [...new Set(eventIds.filter(Boolean))];
  if (ids.length === 0) return resolveRecipientNames([], []);
  const events = await selectIn<RecipientEventRow>('notification_events', RECIPIENT_EVENT_COLUMNS, ids);
  const workerIds = workerIdsToLookup(events);
  const cleaners = workerIds.length > 0 ? await selectIn<CleanerNameRow>('cleaners', CLEANER_NAME_COLUMNS, workerIds) : [];
  return resolveRecipientNames(events, cleaners);
}

/** Nombres de los eventos de la cola, independientes de la página del historial. */
export function useRecipientNames(eventIds: string[], enabled: boolean): RecipientLookup & { refetch: () => void } {
  const key = [...new Set(eventIds)].sort();
  const query = useQuery({
    queryKey: ['whatsapp-recipient-names', key],
    queryFn: () => fetchRecipientNames(key),
    enabled: enabled && key.length > 0,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const refetch = () => void query.refetch();
  if (query.data) return { status: 'ready', byEvent: query.data, refetch };
  if (query.isError) return { status: 'error', refetch };
  return { status: 'loading', refetch };
}
