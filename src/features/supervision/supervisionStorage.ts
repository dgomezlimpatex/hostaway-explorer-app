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
  const code = String(value?.code || '').toUpperCase();
  const message = String(value?.message || '').toLowerCase();
  return code === '42P01'
    || code === 'PGRST205'
    || (message.includes('relation') && message.includes('does not exist'));
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

  if (remoteResult.mode === 'remote') writeLocal(sedeId, date, remoteResult.value);
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
    const result = data as SupervisionRoute;
    const snapshot = readLocal(sedeId, date);
    writeLocal(sedeId, date, { ...snapshot, routes: upsertLocal(snapshot.routes, result) });
    return result;
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
    const result = data as SupervisionStop;
    const snapshot = readLocal(sedeId, date);
    writeLocal(sedeId, date, { ...snapshot, stops: upsertLocal(snapshot.stops, result) });
    return result;
  } catch (error) {
    if (!isMissingSupervisionSchema(error) && !isNetworkError(error)) throw error;
    await queueAndLocal(sedeId, date, 'stop', 'insert', { table: 'supervision_route_stops', data: value }, 'stops', value);
    return value;
  }
}

export async function reorderStop(
  sedeId: string,
  date: string,
  stop: SupervisionStop,
  direction: 'up' | 'down',
  knownStops: SupervisionStop[] = [],
): Promise<void> {
  const snapshot = readLocal(sedeId, date);
  const routeStops = (knownStops.length > 0 ? knownStops : snapshot.stops)
    .filter((value) => value.route_id === stop.route_id)
    .sort((a, b) => a.sequence - b.sequence);
  const index = routeStops.findIndex((value) => value.id === stop.id);
  const neighbor = routeStops[direction === 'up' ? index - 1 : index + 1];
  if (index < 0 || !neighbor) return;

  const temporarySequence = -1;
  const operations = [
    { id: stop.id, sequence: temporarySequence },
    { id: neighbor.id, sequence: stop.sequence },
    { id: stop.id, sequence: neighbor.sequence },
  ];
  try {
    for (const operation of operations) {
      const { error } = await db.from('supervision_route_stops').update({ sequence: operation.sequence }).eq('id', operation.id);
      if (error) throw error;
    }
  } catch (error) {
    if (!isMissingSupervisionSchema(error) && !isNetworkError(error)) throw error;
    for (const operation of operations) {
      await enqueueOffline({ entity: 'stop', operation: 'update', payload: { table: 'supervision_route_stops', id: operation.id, data: { sequence: operation.sequence } } });
    }
  }

  writeLocal(sedeId, date, {
    ...snapshot,
    stops: (snapshot.stops.length > 0 ? snapshot.stops : routeStops).map((value) => {
      if (value.id === stop.id) return { ...value, sequence: neighbor.sequence, updated_at: now() };
      if (value.id === neighbor.id) return { ...value, sequence: stop.sequence, updated_at: now() };
      return value;
    }),
  });
}

export async function createReservationSnapshot(sedeId: string, date: string, snapshot: Omit<SupervisionReservationSnapshot, 'id' | 'captured_at'>): Promise<SupervisionReservationSnapshot> {
  const value: SupervisionReservationSnapshot = { ...snapshot, id: makeId(), captured_at: now() };
  try {
    const { data, error } = await db.from('supervision_reservation_snapshots').insert({ ...value }).select('*').single();
    if (error) throw error;
    const result = data as SupervisionReservationSnapshot;
    const snapshot = readLocal(sedeId, date);
    writeLocal(sedeId, date, { ...snapshot, reservations: upsertLocal(snapshot.reservations, result) });
    return result;
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
    const { error: stopError } = await db.from('supervision_route_stops').update({ status: value.state === 'returned_for_rework' ? 'needs_rework' : 'reviewed' }).eq('id', value.route_stop_id);
    if (stopError) throw stopError;
    const { error: eventError } = await db.from('supervision_review_events').insert({ review_id: value.id, to_state: value.state, reason: value.rework_reason || null, actor_user_id: value.reviewer_user_id || null });
    if (eventError) throw eventError;
    const result = data as SupervisionReview;
    const snapshot = readLocal(sedeId, date);
    writeLocal(sedeId, date, {
      ...snapshot,
      reviews: upsertLocal(snapshot.reviews, result),
      stops: snapshot.stops.map((stop) => stop.id === value.route_stop_id ? { ...stop, status: value.state === 'returned_for_rework' ? 'needs_rework' : 'reviewed' } : stop),
    });
    return result;
  } catch (error) {
    if (!isMissingSupervisionSchema(error) && !isNetworkError(error)) throw error;
    await queueAndLocal(sedeId, date, 'review', 'insert', { table: 'supervision_reviews', data: value }, 'reviews', value);
    await enqueueOffline({ entity: 'review', operation: 'update', payload: { table: 'supervision_route_stops', id: value.route_stop_id, data: { status: value.state === 'returned_for_rework' ? 'needs_rework' : 'reviewed' } } });
    await enqueueOffline({ entity: 'review', operation: 'insert', payload: { table: 'supervision_review_events', data: { review_id: value.id, to_state: value.state, reason: value.rework_reason || null, actor_user_id: value.reviewer_user_id || null } } });
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
    const { error: eventError } = await db.from('supervision_incident_events').insert({ incident_id: value.id, event_type: 'created', to_status: value.status, actor_user_id: value.created_by || null });
    if (eventError) throw eventError;
    if (value.priority === 'high' || value.priority === 'critical') {
      const { error: notificationError } = await supabase.functions.invoke('send-supervision-incident-email', { body: { incidentId: value.id } });
      if (notificationError) console.warn('Supervision incident notification failed:', notificationError.message);
    }
    const result = data as SupervisionIncident;
    const snapshot = readLocal(sedeId, date);
    writeLocal(sedeId, date, { ...snapshot, incidents: upsertLocal(snapshot.incidents, result) });
    return result;
  } catch (error) {
    if (!isMissingSupervisionSchema(error) && !isNetworkError(error)) throw error;
    await queueAndLocal(sedeId, date, 'incident', 'insert', { table: 'supervision_incidents', data: value }, 'incidents', value);
    await enqueueOffline({ entity: 'incident', operation: 'insert', payload: { table: 'supervision_incident_events', data: { incident_id: value.id, event_type: 'created', to_status: value.status, actor_user_id: value.created_by || null } } });
    return value;
  }
}

export async function updateIncidentStatus(sedeId: string, date: string, incident: SupervisionIncident, status: SupervisionIncident['status']): Promise<SupervisionIncident> {
  const value = { ...incident, status, updated_at: now() };
  try {
    const { data, error } = await db.from('supervision_incidents').update({ status, updated_at: value.updated_at }).eq('id', incident.id).select('*').single();
    if (error) throw error;
    const { error: eventError } = await db.from('supervision_incident_events').insert({ incident_id: incident.id, event_type: 'status_change', from_status: incident.status, to_status: status });
    if (eventError) throw eventError;
    const result = data as SupervisionIncident;
    const snapshot = readLocal(sedeId, date);
    writeLocal(sedeId, date, { ...snapshot, incidents: upsertLocal(snapshot.incidents, result) });
    return result;
  } catch (error) {
    if (!isMissingSupervisionSchema(error) && !isNetworkError(error)) throw error;
    await queueAndLocal(sedeId, date, 'incident', 'update', { table: 'supervision_incidents', id: incident.id, data: { status } }, 'incidents', value);
    await enqueueOffline({ entity: 'incident', operation: 'insert', payload: { table: 'supervision_incident_events', data: { incident_id: incident.id, event_type: 'status_change', from_status: incident.status, to_status: status } } });
    return value;
  }
}

export async function completeRoute(sedeId: string, date: string, route: SupervisionRoute): Promise<SupervisionRoute> {
  const value = { ...route, status: 'completed' as const, completed_at: now(), updated_at: now() };
  try {
    const { data, error } = await db.from('supervision_routes').update({ status: value.status, completed_at: value.completed_at }).eq('id', route.id).select('*').single();
    if (error) throw error;
    const result = data as SupervisionRoute;
    const snapshot = readLocal(sedeId, date);
    writeLocal(sedeId, date, { ...snapshot, routes: upsertLocal(snapshot.routes, result) });
    return result;
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
        const { data: updatedRows, error } = await db.from(table).update(item.payload.data || {}).eq('id', item.payload.id).select('id');
        if (error) throw error;
        if (!updatedRows || updatedRows.length === 0) throw new Error(`No se actualizó ninguna fila en ${table}`);
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

function projectTaskForSupervision(task: Task): Task {
  return {
    id: task.id,
    created_at: task.created_at,
    updated_at: task.updated_at,
    property: task.property,
    propertyCode: task.propertyCode,
    propertyDurationMinutes: task.propertyDurationMinutes,
    propertyName: task.propertyName,
    propertyAddress: task.propertyAddress,
    address: task.address,
    date: task.date,
    startTime: task.startTime,
    endTime: task.endTime,
    duration: task.duration,
    checkIn: task.checkIn,
    checkOut: task.checkOut,
    type: task.type,
    status: task.status,
    cleaner: task.cleaner,
    cleanerId: task.cleanerId,
    propertyId: task.propertyId,
    sedeId: task.sedeId,
    backgroundColor: task.backgroundColor,
    originalTaskId: task.originalTaskId,
  };
}

export async function getSupervisionTasks(sedeId: string, date: string): Promise<Task[]> {
  const tasks = await taskStorageService.getTasksForSupervision({ dateFrom: date, dateTo: date, sedeId });
  return tasks.map(projectTaskForSupervision);
}
