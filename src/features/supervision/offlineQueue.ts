export interface OfflineQueueItem {
  id: string;
  ownerUserId: string;
  entity: 'route' | 'stop' | 'review' | 'incident' | 'photo';
  operation: 'insert' | 'update' | 'upload' | 'rpc';
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

const DB_NAME = 'limpatex-supervision-offline';
const STORE_NAME = 'queue';
const FALLBACK_PREFIX = 'limpatex-supervision-offline-queue';

let queueOwnerUserId: string | null = null;

export function setSupervisionQueueOwner(userId: string | null): void {
  queueOwnerUserId = userId || null;
}

export function getSupervisionQueueOwner(): string | null {
  return queueOwnerUserId;
}

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const openDb = (): Promise<IDBDatabase | null> => new Promise((resolve) => {
  if (typeof indexedDB === 'undefined') return resolve(null);
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(null);
});

const fallbackKey = (userId: string) => `${FALLBACK_PREFIX}:${userId}`;

const fallbackRead = (userId: string): OfflineQueueItem[] => {
  try {
    return JSON.parse(localStorage.getItem(fallbackKey(userId)) || '[]') as OfflineQueueItem[];
  } catch {
    return [];
  }
};

const fallbackWrite = (userId: string, items: OfflineQueueItem[]) => localStorage.setItem(fallbackKey(userId), JSON.stringify(items));

function requireOwnerUserId(): string {
  if (!queueOwnerUserId) throw new Error('No hay una sesión autenticada para guardar operaciones offline');
  return queueOwnerUserId;
}

export async function enqueueOffline(item: Omit<OfflineQueueItem, 'id' | 'ownerUserId' | 'createdAt' | 'attempts'>): Promise<OfflineQueueItem> {
  const ownerUserId = requireOwnerUserId();
  const value: OfflineQueueItem = { ...item, ownerUserId, id: makeId(), createdAt: new Date().toISOString(), attempts: 0 };
  const db = await openDb();
  if (!db) {
    fallbackWrite(ownerUserId, [...fallbackRead(ownerUserId), value]);
    return value;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('No se pudo guardar la operación offline'));
      tx.onabort = () => reject(tx.error || new Error('La transacción offline fue cancelada'));
    });
  } catch (error) {
    fallbackWrite(ownerUserId, [...fallbackRead(ownerUserId), value]);
    if (localStorage.getItem(fallbackKey(ownerUserId)) === null) throw error;
  } finally {
    db.close();
  }
  return value;
}

export async function listOfflineQueue(ownerUserId = queueOwnerUserId): Promise<OfflineQueueItem[]> {
  if (!ownerUserId) return [];
  const db = await openDb();
  if (!db) return fallbackRead(ownerUserId);
  try {
    const values = await new Promise<OfflineQueueItem[]>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(((request.result || []) as OfflineQueueItem[]).filter((item) => item.ownerUserId === ownerUserId));
      request.onerror = () => reject(request.error || new Error('No se pudo leer la cola offline'));
    });
    return values.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return fallbackRead(ownerUserId);
  } finally {
    db.close();
  }
}

export async function removeOfflineQueueItem(id: string): Promise<void> {
  const ownerUserId = queueOwnerUserId;
  if (!ownerUserId) return;
  const db = await openDb();
  if (!db) {
    fallbackWrite(ownerUserId, fallbackRead(ownerUserId).filter((item) => item.id !== id));
    return;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('No se pudo eliminar la operación offline'));
      tx.onabort = () => reject(tx.error || new Error('La transacción offline fue cancelada'));
    });
  } catch {
    fallbackWrite(ownerUserId, fallbackRead(ownerUserId).filter((item) => item.id !== id));
  } finally {
    db.close();
  }
}

export async function markOfflineQueueFailure(item: OfflineQueueItem, error: unknown): Promise<void> {
  const ownerUserId = item.ownerUserId;
  const next = { ...item, attempts: item.attempts + 1, lastError: error instanceof Error ? error.message : String(error) };
  const db = await openDb();
  if (!db) {
    fallbackWrite(ownerUserId, fallbackRead(ownerUserId).map((value) => value.id === item.id ? next : value));
    return;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(next);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('No se pudo actualizar la operación offline'));
      tx.onabort = () => reject(tx.error || new Error('La transacción offline fue cancelada'));
    });
  } catch {
    fallbackWrite(ownerUserId, fallbackRead(ownerUserId).map((value) => value.id === item.id ? next : value));
  } finally {
    db.close();
  }
}
