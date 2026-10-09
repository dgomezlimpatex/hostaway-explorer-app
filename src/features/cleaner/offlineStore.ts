import type { AdditionalTask, Task } from '@/types/calendar';
import type { TaskChecklistTemplate, TaskReport } from '@/types/taskReports';
import { prepareLocalPhoto } from './prepareLocalPhoto';

export interface CleanerDraft {
  key: string;
  ownerId: string;
  sedeId: string;
  task: Task;
  report: TaskReport;
  checklistTemplate?: TaskChecklistTemplate;
  base: TaskReport | null;
  serverId?: string;
  revision: number;
  syncedRevision: number;
  finishRequested: boolean;
  subtasks: Record<string, AdditionalTask>;
  error?: string;
}

export interface CleanerPhoto {
  key: string;
  ownerId: string;
  taskId: string;
  id: string;
  checklistItemId?: string;
  file: Blob;
  name: string;
  mimeType: string;
  capturedAt: string;
  serverUrl?: string;
}

interface CacheEntry<T> { key: string; data: T; savedAt: number }
const DB_NAME = 'limpatex-cleaner-v1';
export const LOCAL_PHOTO_PREFIX = 'cleaner-photo:';
let dbPromise: Promise<IDBDatabase> | undefined;
let version = 0;
const listeners = new Set<() => void>();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(DB_NAME) : null;

const publish = () => {
  version++;
  listeners.forEach(listener => listener());
};
if (channel) channel.onmessage = publish;
export const notifyCleanerStore = () => { publish(); channel?.postMessage('changed'); };
export const subscribeCleanerStore = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const getCleanerStoreVersion = () => version;
export const draftKey = (ownerId: string, taskId: string) => `${ownerId}:${taskId}`;

const openDatabase = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('Este navegador no permite guardar el trabajo en el móvil.'));
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        ['drafts', 'photos', 'cache', 'leases'].forEach(name => {
          request.result.createObjectStore(name, { keyPath: 'key' });
        });
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Cierra las otras pestañas de Limpatex para preparar el guardado.'));
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); dbPromise = undefined; };
        resolve(request.result);
      };
    }).catch(error => { dbPromise = undefined; throw error; });
  }
  return dbPromise;
};

export async function readLocal<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function listLocal<T>(store: string, ownerId: string): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).getAll(
      IDBKeyRange.bound(`${ownerId}:`, `${ownerId}:\uffff`),
    );
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

// Resolve only after the transaction commits. A full disk must never look like a saved photo.
export async function writeLocal<T extends { key: string }>(store: string, value: T): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => { if (store !== 'cache') notifyCleanerStore(); resolve(value); };
    tx.onabort = () => reject(tx.error || new Error('No se ha podido guardar. Comprueba el espacio libre del móvil.'));
    tx.onerror = () => reject(tx.error);
  });
}

// Read and modify in ONE transaction, so a sync acknowledgment cannot erase a newer edit.
export async function changeDraft(key: string, change: (draft: CleanerDraft | undefined) => CleanerDraft): Promise<CleanerDraft> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', 'readwrite');
    const store = tx.objectStore('drafts');
    const request = store.get(key);
    let result: CleanerDraft;
    request.onsuccess = () => {
      try { result = change(request.result); store.put(result); }
      catch (error) { tx.abort(); reject(error); }
    };
    tx.oncomplete = () => { notifyCleanerStore(); resolve(result); };
    tx.onabort = () => reject(tx.error || new Error('No se ha podido conservar el avance en este móvil.'));
    tx.onerror = () => reject(tx.error);
  });
}

export async function savePhotoWithDraft(key: string, photo: CleanerPhoto): Promise<CleanerDraft> {
  // Read the actual bytes before opening a transaction. Awaiting file reads inside
  // the transaction would make it inactive; storing the original File can fail on Android.
  const savedPhoto = { ...photo, file: await prepareLocalPhoto(photo.file, photo.mimeType) };
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['photos', 'drafts'], 'readwrite');
    const drafts = tx.objectStore('drafts');
    const request = drafts.get(key);
    let result: CleanerDraft;
    request.onsuccess = () => {
      try {
        const current = request.result as CleanerDraft | undefined;
        if (!current || current.finishRequested || current.ownerId !== photo.ownerId ||
            current.report.task_id !== photo.taskId || photo.key !== `${photo.ownerId}:${photo.id}`) {
          tx.abort(); return;
        }
        const checklist = { ...current.report.checklist_completed };
        if (photo.checklistItemId) {
          const item = checklist[photo.checklistItemId] || {};
          checklist[photo.checklistItemId] = {
            ...item, completed: photo.checklistItemId.startsWith('additional.') ? Boolean(item.completed) : true,
            media_urls: [...(item.media_urls || []), `${LOCAL_PHOTO_PREFIX}${photo.id}`],
          };
        }
        result = {
          ...current, revision: current.revision + 1, error: undefined,
          report: { ...current.report, checklist_completed: checklist, updated_at: new Date().toISOString() },
        };
        if (photo.checklistItemId?.startsWith('additional.')) {
          const extraId = photo.checklistItemId.slice('additional.'.length);
          const extra = current.subtasks[extraId] || current.task.additionalTasks?.find(item => item.id === extraId);
          if (extra) result.subtasks = { ...current.subtasks, [extraId]: { ...extra, mediaUrls: checklist[photo.checklistItemId].media_urls } };
        }
        tx.objectStore('photos').put(savedPhoto);
        drafts.put(result);
      } catch (error) {
        tx.abort();
        reject(error);
      }
    };
    tx.oncomplete = () => { notifyCleanerStore(); resolve(result); };
    tx.onabort = () => reject(tx.error || new Error('La foto no se ha guardado. Comprueba el espacio libre y vuelve a adjuntarla.'));
    tx.onerror = () => reject(tx.error);
  });
}

export async function acquireSyncLease(ownerId: string, token: string): Promise<boolean> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('leases', 'readwrite');
    const store = tx.objectStore('leases');
    const request = store.get(ownerId);
    let acquired = false;
    request.onsuccess = () => {
      const lease = request.result;
      if (!lease || lease.until < Date.now() || lease.token === token) {
        acquired = true;
        store.put({ key: ownerId, token, until: Date.now() + 120_000 });
      }
    };
    tx.oncomplete = () => resolve(acquired);
    tx.onabort = () => reject(tx.error);
  });
}

export async function releaseSyncLease(ownerId: string, token: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('leases', 'readwrite');
    const store = tx.objectStore('leases');
    const request = store.get(ownerId);
    request.onsuccess = () => { if (request.result?.token === token) store.delete(ownerId); };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}

export async function readCleanerCache<T>(key: string): Promise<CacheEntry<T> | undefined> {
  return readLocal<CacheEntry<T>>('cache', key);
}
export const cacheCleanerData = <T>(key: string, data: T) => writeLocal('cache', { key, data, savedAt: Date.now() });

/** Retain unsent work indefinitely. Reclaim only confirmed, completed work older than a week. */
export async function pruneConfirmedCleanerWork(ownerId: string): Promise<void> {
  const db = await openDatabase();
  const cutoff = Date.now() - 7 * 24 * 60 * 60_000;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['drafts', 'photos'], 'readwrite');
    const drafts = tx.objectStore('drafts');
    const photos = tx.objectStore('photos');
    const request = drafts.getAll(IDBKeyRange.bound(`${ownerId}:`, `${ownerId}:\uffff`));
    request.onsuccess = () => {
      const removable = new Set((request.result as CleanerDraft[]).filter(draft =>
        draft.finishRequested && draft.revision === draft.syncedRevision &&
        Date.parse(draft.report.end_time || '') < cutoff).map(draft => draft.report.task_id));
      const photoRequest = photos.getAll(IDBKeyRange.bound(`${ownerId}:`, `${ownerId}:\uffff`));
      photoRequest.onsuccess = () => {
        const savedPhotos = photoRequest.result as CleanerPhoto[];
        savedPhotos.forEach(photo => { if (!photo.serverUrl) removable.delete(photo.taskId); });
        savedPhotos.forEach(photo => { if (removable.has(photo.taskId)) photos.delete(photo.key); });
        (request.result as CleanerDraft[]).forEach(draft => { if (removable.has(draft.report.task_id)) drafts.delete(draft.key); });
      };
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}

export const withTimeout = async <T>(operation: PromiseLike<T>, ms = 10_000): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('La conexión no responde. El trabajo sigue guardado en el móvil.')), ms); }),
    ]);
  } finally { clearTimeout(timer); }
};

export async function readWithCleanerCache<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cached = await readCleanerCache<T>(key).catch(() => undefined);
  if (!navigator.onLine) {
    if (cached) return cached.data;
    throw new Error('Abre esta pantalla con cobertura una vez para guardarla en el móvil.');
  }
  try {
    const data = await withTimeout(load());
    await cacheCleanerData(key, data).catch(() => undefined);
    return data;
  } catch (error) {
    if (cached) return cached.data;
    throw error;
  }
}
