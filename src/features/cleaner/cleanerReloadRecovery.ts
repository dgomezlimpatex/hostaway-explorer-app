import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Task } from '@/types/calendar';

/*
 * Old Android phones close the browser tab to free memory while the camera is open.
 * When the cleaner returns, Chrome reloads the page on the task list and the open report
 * and the photo being taken are gone. Remember the open task and the pending photo choice.
 */
const OPEN_TASK_KEY = 'limpatex:cleaner-open-task';
const PHOTO_PICKING_KEY = 'limpatex:cleaner-photo-picking';
const OPEN_TASK_MAX_AGE_MS = 6 * 60 * 60_000;
const PHOTO_PICKING_MAX_AGE_MS = 15 * 60_000;

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const storageOf = (kind: 'localStorage' | 'sessionStorage'): KeyValueStorage | null => {
  try { return typeof window === 'undefined' ? null : window[kind]; } catch { return null; }
};
const readJson = <T,>(storage: KeyValueStorage | null, key: string): T | null => {
  try { return JSON.parse(storage?.getItem(key) || 'null') as T | null; } catch { return null; }
};
const writeJson = (storage: KeyValueStorage | null, key: string, value: unknown) => {
  try { storage?.setItem(key, JSON.stringify(value)); } catch { /* Private mode or full storage: recovery is optional. */ }
};
const forget = (storage: KeyValueStorage | null, key: string) => {
  try { storage?.removeItem(key); } catch { /* Optional recovery data. */ }
};

export function rememberOpenTask(ownerId: string, taskId: string, now = Date.now(), storage = storageOf('localStorage')) {
  writeJson(storage, OPEN_TASK_KEY, { ownerId, taskId, savedAt: now });
}
export function forgetOpenTask(storage = storageOf('localStorage')) {
  forget(storage, OPEN_TASK_KEY);
}
export function readOpenTask(ownerId: string, now = Date.now(), storage = storageOf('localStorage')): string | null {
  const saved = readJson<{ ownerId?: string; taskId?: string; savedAt?: number }>(storage, OPEN_TASK_KEY);
  if (!saved?.taskId || saved.ownerId !== ownerId || !(now - Number(saved.savedAt) < OPEN_TASK_MAX_AGE_MS)) return null;
  return saved.taskId;
}
export const findOpenTask = (tasks: Task[], taskId: string) =>
  tasks.find(task => task.id === taskId) || tasks.find(task => (task.originalTaskId || task.id) === taskId) || null;

/** Selected report that survives a reload of the tab by the phone. */
export function useOpenCleanerTask(tasks: Task[], ready: boolean) {
  const { user } = useAuth();
  const ownerId = user?.id;
  const [selected, setSelectedState] = useState<Task | null>(null);
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !ready || !ownerId) return;
    restored.current = true;
    const taskId = readOpenTask(ownerId);
    if (!taskId) return;
    const task = findOpenTask(tasks, taskId);
    if (task) setSelectedState(current => current || task);
    else forgetOpenTask();
  }, [ready, ownerId, tasks]);
  const setSelected = useCallback((task: Task | null) => {
    restored.current = true;
    setSelectedState(task);
    if (task && ownerId) rememberOpenTask(ownerId, task.id);
    else forgetOpenTask();
  }, [ownerId]);
  return [selected, setSelected] as const;
}

/** Call right before opening the photo picker. Returning to the page alive clears the mark. */
export function markPhotoPicking(now = Date.now(), storage = storageOf('sessionStorage')) {
  writeJson(storage, PHOTO_PICKING_KEY, { at: now });
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const returned = () => {
    if (document.visibilityState === 'hidden') return;
    clearPhotoPicking(storage);
    window.removeEventListener('focus', returned);
    document.removeEventListener('visibilitychange', returned);
  };
  // Register after the click so the current focus does not clear the mark immediately.
  setTimeout(() => {
    window.addEventListener('focus', returned);
    document.addEventListener('visibilitychange', returned);
  }, 500);
}
export function clearPhotoPicking(storage = storageOf('sessionStorage')) {
  forget(storage, PHOTO_PICKING_KEY);
}
/** True once if the page was restarted while the camera or gallery was open. */
export function consumePhotoPickingRestart(now = Date.now(), storage = storageOf('sessionStorage')): boolean {
  const saved = readJson<{ at?: number }>(storage, PHOTO_PICKING_KEY);
  if (!saved) return false;
  clearPhotoPicking(storage);
  return now - Number(saved.at) < PHOTO_PICKING_MAX_AGE_MS;
}
