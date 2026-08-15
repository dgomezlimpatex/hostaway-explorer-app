export interface OfflineQueueItem {
  id: string;
  entity: 'route' | 'stop' | 'review' | 'incident' | 'photo';
  operation: 'insert' | 'update' | 'upload';
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

const DB_NAME = 'limpatex-supervision-offline';
const STORE_NAME = 'queue';
const FALLBACK_KEY = 'limpatex-supervision-offline-queue';

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const openDb = (): Promise<IDBDatabase | null> => new Promise((resolve) => {
  if (typeof indexedDB === 'undefined') return resolve(null);
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(null);
});

const fallbackRead = (): OfflineQueueItem[] => {
  try {
    return JSON.parse(localStorage.getItem(FALLBACK_KEY) || '[]') as OfflineQueueItem[];
  } catch {
    return [];
  }
};

const fallbackWrite = (items: OfflineQueueItem[]) => localStorage.setItem(FALLBACK_KEY, JSON.stringify(items));

export async function enqueueOffline(item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'attempts'>): Promise<OfflineQueueItem> {
  const value: OfflineQueueItem = { ...item, id: makeId(), createdAt: new Date().toISOString(), attempts: 0 };
  const db = await openDb();
  if (!db) {
    fallbackWrite([...fallbackRead(), value]);
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
  } finally {
    db.close();
  }
  return value;
}

export async function listOfflineQueue(): Promise<OfflineQueueItem[]> {
  const db = await openDb();
  if (!db) return fallbackRead();
  const values = await new Promise<OfflineQueueItem[]>((resolve) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result || []) as OfflineQueueItem[]);
    request.onerror = () => resolve([]);
  });
  db.close();
  return values.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeOfflineQueueItem(id: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    fallbackWrite(fallbackRead().filter((item) => item.id !== id));
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
  } finally {
    db.close();
  }
}

export async function markOfflineQueueFailure(item: OfflineQueueItem, error: unknown): Promise<void> {
  const next = { ...item, attempts: item.attempts + 1, lastError: error instanceof Error ? error.message : String(error) };
  const db = await openDb();
  if (!db) {
    fallbackWrite(fallbackRead().map((value) => value.id === item.id ? next : value));
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
  } finally {
    db.close();
  }
}
