import { supabase } from '@/integrations/supabase/client';
import { taskStorageService } from '@/services/taskStorage';
import type { Task } from '@/types/calendar';
import type {
  SupervisionIncident,
  SupervisionReservationSnapshot,
  SupervisionReview,
  SupervisionRoute,
  SupervisionStop,
  SupervisionWorkspaceData,
} from './types';
import { enqueueOffline, listOfflineQueue, markOfflineQueueFailure, removeOfflineQueueItem, type OfflineQueueItem } from './offlineQueue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generated Supabase types are refreshed after migration deployment.
const db = supabase as any;
const LOCAL_PREFIX = 'limpatex-supervision-snapshot';

interface LocalSnapshot {
  routes: SupervisionRoute[];
  stops: SupervisionStop[];
  reviews: SupervisionReview[];
  reservations: SupervisionReservationSnapshot[];
  incidents: SupervisionIncident[];
}

const now = () => new Date().toISOString();
const makeId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const localKey = (sedeId: string, date: string) => `${LOCAL_PREFIX}:${sedeId}:${date}`;

const emptySnapshot = (): LocalSnapshot => ({ routes: [], stops: [], reviews: [], reservations: [], incidents: [] });

function readLocal(sedeId: string, date: string): LocalSnapshot {
  try {
    const parsed = JSON.parse(localStorage.getItem(localKey(sedeId, date)) || 'null');
    return parsed ? { ...emptySnapshot(), ...parsed } : emptySnapshot();
  } catch {
    return emptySnapshot();
  }
}

function writeLocal(sedeId: string, date: string, snapshot: LocalSnapshot): void {
  localStorage.setItem(localKey(sedeId, date), JSON.stringify(snapshot));
}

function isMissingSupervisionSchema(error: unknown): boolean {
  const value = error as { code?: string; message?: string } | null;
  const message = `${value?.code || ''} ${value?.message || ''}`.toLowerCase();
  return message.includes('42p01') || message.includes('pgrst205') || message.includes('supervision_');
}

function isNetworkError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || error || '').toLowerCase();
  return message.includes('failed to fetch') || message.includes('network') || message.includes('offline');
}

async function remoteOrOffline<T>(remote: () => Promise<T>, fallback: () => T): Promise<{ value: T; mode: 'remote' | 'offline'; warning?: string }> {
  try {
    return { value: await remote(), mode: 'remote' };
  } catch (error) {
    if (!isMissingSupervisionSchema(error) && !isNetworkError(error)) throw error;
    return {
      value: fallback(),
      mode: 'offline',
      warning: isMissingSupervisionSchema(error)
        ? 'La migración de supervisión todavía no está aplicada. Se está trabajando en modo local y la cola quedará preparada para sincronizar.'
        : 'Sin conexión con el servidor. Los cambios se guardarán en el dispositivo y se reintentará la sincronización.',
    };
  }
}

export async function fetchSupervisionWorkspace(sedeId: string, date: string): Promise<SupervisionWorkspaceData> {
  const local = readLocal(sedeId, date);
  const remoteResult = await remoteOrOffline(
    async () => {
      const { data: routes, error: routeError } = await db
        .from('supervision_routes')
        .select('*')
        .eq('sede_id', sedeId)
        .eq('route_date', date)
        .order('created_at', { ascending: false });
      if (routeError) throw routeError;
      const routeRows = (routes || []) as SupervisionRoute[];
      const routeIds = routeRows.map((route) => route.id);
      if (routeIds.length === 0) return { routes: routeRows, stops: [], reviews: [], reservations: [], incidents: [] } as LocalSnapshot;
      const { data: stopData, error: stopError } = await db
        .from('supervision_route_stops')
        .select('*')
        .in('route_id', routeIds)
        .order('sequence', { ascending: true });
      if (stopError) throw stopError;
      const stopRows = (stopData || []) as SupervisionStop[];
      const stopIds = stopRows.map((stop) => stop.id);
      const [reviews, reservations, incidents] = await Promise.all([
        db.from('supervision_reviews').select('*').in('route_id', routeIds).order('created_at', { ascending: false }),
        stopIds.length > 0 ? db.from('supervision_reservation_snapshots').select('*').in('route_stop_id', stopIds) : Promise.resolve({ data: [], error: null }),
        db.from('supervision_incidents').select('*').in('route_id', routeIds).order('created_at', { ascending: false }),
      ]);
      for (const result of [reviews, reservations, incidents]) if (result.error) throw result.error;
      return {
        routes: routeRows,
        stops: stopRows,
        reviews: (reviews.data || []) as SupervisionReview[],
        reservations: (reservations.data || []) as SupervisionReservationSnapshot[],
        incidents: (incidents.data || []) as SupervisionIncident[],
      };
    },
    () => local,
  );

  return { ...remoteResult.value, storageMode: remoteResult.mode, warning: remoteResult.warning };
}

function upsertLocal<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((value) => value.id === item.id);
  if (index === -1) return [...items, item];
  const next = [...items];
  next[index] = { ...next[index], ...item };
  return next;
}

async function queueAndLocal<T extends keyof LocalSnapshot>(
  sedeId: string,
  date: string,
  entity: OfflineQueueItem['entity'],
  operation: OfflineQueueItem['operation'],
  payload: Record<string, unknown>,
  collection: T,
  value: LocalSnapshot[T][number],
): Promise<void> {
  const snapshot = readLocal(sedeId, date);
  const items = snapshot[collection] as Array<{ id: string }>;
  (snapshot[collection] as Array<{ id: string }>) = upsertLocal(items, value as { id: string }) as LocalSnapshot[T];
  writeLocal(sedeId, date, snapshot);
  await enqueueOffline({ entity, operation, payload });
}

export async function createRoute(sedeId: string, date: string, name: string, reviewerUserId?: string | null): Promise<SupervisionRoute> {
  const route: SupervisionRoute = {
    id: makeId(), sede_id: sedeId, route_date: date, name: name.trim() || `Ruta ${date}`,
    reviewer_user_id: reviewerUserId || null, status: 'planned', created_at: now(), updated_at: now(),
  };
  try {
    const { data, error } = await db.from('supervision_routes').insert({ ...route }).select('*').single();
    if (error) throw error;
    return data as SupervisionRoute;
  } catch (error) {
    if (!isMissingSupervisionSchema(error) && !isNetworkError(error)) throw error;
    await queueAndLocal(sedeId, date, 'route', 'insert', { table: 'supervision_routes', data: route }, 'routes', route);
    return route;
  }
}

export async function addStop(sedeId: string, date: string, stop: Omit<SupervisionStop, 'id' | 'created_at' | 'updated_at'>): Promise<SupervisionStop> {
  const value: SupervisionStop = { ...stop, id: makeId(), created_at: now(), updated_at: now() };
  try {
    const { data, error } = await db.from('supervision_route_stops').insert({ ...value }).select('*').single();
    if (error) throw error;
    return data as SupervisionStop;
  } catch (error) {
    if (!isMissingSupervisionSchema(error) && !isNetworkError(error)) throw error;
    await queueAndLocal(sedeId, date, 'stop', 'insert', { table: 'supervision_route_stops', data: value }, 'stops', value);
    return value;
  }
}

export async function createReservationSnapshot(sedeId: string, date: string, snapshot: Omit<SupervisionReservationSnapshot, 'id' | 'captured_at'>): Promise<SupervisionReservationSnapshot> {
  const value: SupervisionReservationSnapshot = { ...snapshot, id: makeId(), captured_at: now() };
  try {
    const { data, error } = await db.from('supervision_reservation_snapshots').insert({ ...value }).select('*').single();
    if (error) throw error;
    return data as SupervisionReservationSnapshot;
  } catch (error) {
    if (!isMissingSupervisionSchema(error) && !isNetworkError(error)) throw error;
    await queueAndLocal(sedeId, date, 'stop', 'insert', { table: 'supervision_reservation_snapshots', data: value }, 'reservations', value);
    return value;
  }
}

export async function saveReview(sedeId: string, date: string, review: Omit<SupervisionReview, 'id' | 'created_at' | 'updated_at'>): Promise<SupervisionReview> {
  const value: SupervisionReview = { ...review, id: makeId(), created_at: now(), updated_at: now() };
  try {
    const { data, error } = await db.from('supervision_reviews').insert({ ...value }).select('*').single();
    if (error) throw error;
    await db.from('supervision_route_stops').update({ status: value.state === 'returned_for_rework' ? 'needs_rework' : 'reviewed' }).eq('id', value.route_stop_id);
    await db.from('supervision_review_events').insert({ review_id: value.id, to_state: value.state, reason: value.rework_reason || null, actor_user_id: value.reviewer_user_id || null });
    return data as SupervisionReview;
  } catch (error) {
    if (!isMissingSupervisionSchema(error) && !isNetworkError(error)) throw error;
    await queueAndLocal(sedeId, date, 'review', 'insert', { table: 'supervision_reviews', data: value }, 'reviews', value);
    const snapshot = readLocal(sedeId, date);
    writeLocal(sedeId, date, {
      ...snapshot,
      stops: snapshot.stops.map((stop) => stop.id === value.route_stop_id ? { ...stop, status: value.state === 'returned_for_rework' ? 'needs_rework' : 'reviewed' } : stop),
    });
    return value;
  }
}

export async function createIncident(
  sedeId: string,
  date: string,
  incident: Omit<SupervisionIncident, 'id' | 'created_at' | 'updated_at'>,
): Promise<SupervisionIncident> {
  const value: SupervisionIncident = { ...incident, id: makeId(), created_at: now(), updated_at: now() };
  try {
    const { data, error } = await db.from('supervision_incidents').insert({ ...value }).select('*').single();
    if (error) throw error;
    await db.from('supervision_incident_events').insert({ incident_id: value.id, event_type: 'created', to_status: value.status, actor_user_id: value.created_by || null });
    if (value.priority === 'high' || value.priority === 'critical') {
      void supabase.functions.invoke('send-supervision-incident-email', { body: { incidentId: value.id } });
    }
    return data as SupervisionIncident;
  } catch (error) {
    if (!isMissingSupervisionSchema(error) && !isNetworkError(error)) throw error;
    await queueAndLocal(sedeId, date, 'incident', 'insert', { table: 'supervision_incidents', data: value }, 'incidents', value);
    return value;
  }
}

export async function updateIncidentStatus(sedeId: string, date: string, incident: SupervisionIncident, status: SupervisionIncident['status']): Promise<SupervisionIncident> {
  const value = { ...incident, status, updated_at: now() };
  try {
    const { data, error } = await db.from('supervision_incidents').update({ status, updated_at: value.updated_at }).eq('id', incident.id).select('*').single();
    if (error) throw error;
    await db.from('supervision_incident_events').insert({ incident_id: incident.id, event_type: 'status_change', from_status: incident.status, to_status: status });
    return data as SupervisionIncident;
  } catch (error) {
    if (!isMissingSupervisionSchema(error) && !isNetworkError(error)) throw error;
    await queueAndLocal(sedeId, date, 'incident', 'update', { table: 'supervision_incidents', id: incident.id, data: { status } }, 'incidents', value);
    return value;
  }
}

export async function completeRoute(sedeId: string, date: string, route: SupervisionRoute): Promise<SupervisionRoute> {
  const value = { ...route, status: 'completed' as const, completed_at: now(), updated_at: now() };
  try {
    const { data, error } = await db.from('supervision_routes').update({ status: value.status, completed_at: value.completed_at }).eq('id', route.id).select('*').single();
    if (error) throw error;
    return data as SupervisionRoute;
  } catch (error) {
    if (!isMissingSupervisionSchema(error) && !isNetworkError(error)) throw error;
    await queueAndLocal(sedeId, date, 'route', 'update', { table: 'supervision_routes', id: route.id, data: { status: value.status, completed_at: value.completed_at } }, 'routes', value);
    return value;
  }
}

export async function flushSupervisionQueue(): Promise<{ synced: number; failed: number }> {
  const items = await listOfflineQueue();
  let synced = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const payload = item.payload.data as Record<string, unknown> | undefined;
      if (item.operation === 'insert' && payload) {
        const table = String(item.payload.table || '');
        const { error } = await db.from(table).insert(payload);
        if (error && !String(error.message).toLowerCase().includes('duplicate')) throw error;
      } else if (item.operation === 'update') {
        const table = String(item.payload.table || '');
        const { error } = await db.from(table).update(item.payload.data || {}).eq('id', item.payload.id);
        if (error) throw error;
      } else if (item.operation === 'upload') {
        const photo = item.payload as { path: string; dataUrl: string; reviewId: string; sedeId: string; fileName: string; originalBytes: number };
        const blob = await fetch(photo.dataUrl).then((response) => response.blob());
        const { error: uploadError } = await db.storage.from('supervision-evidence').upload(photo.path, blob, { contentType: 'image/jpeg', upsert: false });
        if (uploadError && !String(uploadError.message).toLowerCase().includes('already exists')) throw uploadError;
        const { error: mediaError } = await db.from('supervision_review_media').insert({ review_id: photo.reviewId, sede_id: photo.sedeId, storage_path: photo.path, original_name: photo.fileName, mime_type: 'image/jpeg', original_bytes: photo.originalBytes, compressed_bytes: blob.size });
        if (mediaError && !String(mediaError.message).toLowerCase().includes('duplicate')) throw mediaError;
      }
      await removeOfflineQueueItem(item.id);
      synced += 1;
    } catch (error) {
      await markOfflineQueueFailure(item, error);
      failed += 1;
    }
  }
  return { synced, failed };
}

export async function compressSupervisionPhoto(file: File, maxEdge = 1600, quality = 0.72): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', quality));
}

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error || new Error('No se pudo preparar la foto para modo offline'));
  reader.readAsDataURL(blob);
});

export async function uploadSupervisionPhoto(sedeId: string, reviewId: string, file: File): Promise<string> {
  const blob = await compressSupervisionPhoto(file);
  const path = `${sedeId}/${reviewId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.jpg`;
  try {
    const { error } = await db.storage.from('supervision-evidence').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    const { error: mediaError } = await db.from('supervision_review_media').insert({
      review_id: reviewId,
      sede_id: sedeId,
      storage_path: path,
      original_name: file.name,
      mime_type: 'image/jpeg',
      original_bytes: file.size,
      compressed_bytes: blob.size,
    });
    if (mediaError) throw mediaError;
    return path;
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    const dataUrl = await blobToDataUrl(blob);
    await enqueueOffline({ entity: 'photo', operation: 'upload', payload: { path, dataUrl, reviewId, sedeId, fileName: file.name, originalBytes: file.size } });
    return path;
  }
}

export async function getSupervisionTasks(sedeId: string, date: string): Promise<Task[]> {
  return taskStorageService.getTasksForReports({ dateFrom: date, dateTo: date, sedeId });
}
