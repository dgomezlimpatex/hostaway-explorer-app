import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getCleanerStoreVersion, listLocal, pruneConfirmedCleanerWork, subscribeCleanerStore, type CleanerDraft, type CleanerPhoto } from './offlineStore';
import { cleanerSyncing, subscribeCleanerSync, syncCleanerWork } from './syncCleanerWork';
import { useCleanerShell } from './useCleanerShell';

interface CleanerOfflineStatus {
  drafts: CleanerDraft[];
  pending: number;
  pendingPhotos: number;
  error: string | null;
  isOnline: boolean;
  isSyncing: boolean;
  shellReady: boolean;
  shellError: boolean;
  sync: () => Promise<void>;
}
const CleanerOfflineContext = createContext<CleanerOfflineStatus | null>(null);
// Shared provider and hook deliberately live together.
// eslint-disable-next-line react-refresh/only-export-components
export const useCleanerOfflineStatus = () => useContext(CleanerOfflineContext);

export function CleanerOfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isCleaner } = useRolePermissions();
  const enabled = isCleaner();
  const client = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const version = useSyncExternalStore(subscribeCleanerStore, getCleanerStoreVersion, () => 0);
  const isSyncing = useSyncExternalStore(subscribeCleanerSync, () => cleanerSyncing, () => false);
  const [drafts, setDrafts] = useState<CleanerDraft[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(null);
  const ownerId = enabled ? user?.id : undefined;
  const shell = useCleanerShell(Boolean(ownerId));
  useEffect(() => {
    if (ownerId) void pruneConfirmedCleanerWork(ownerId).catch(() => undefined);
  }, [ownerId]);

  useEffect(() => {
    let cancelled = false;
    if (!ownerId) { setDrafts([]); setPendingPhotos(0); return; }
    void Promise.all([listLocal<CleanerDraft>('drafts', ownerId), listLocal<CleanerPhoto>('photos', ownerId)])
      .then(([savedDrafts, photos]) => {
        if (cancelled) return;
        setDrafts(savedDrafts);
        setPendingPhotos(photos.filter(photo => !photo.serverUrl).length);
        setStorageError(null);
      }).catch(() => { if (!cancelled) setStorageError('El móvil no permite conservar el trabajo. Comprueba el espacio libre o sal del modo privado.'); });
    return () => { cancelled = true; };
  }, [ownerId, version, client]);

  // React renders the new account before its effect has loaded IndexedDB.
  const ownedDrafts = drafts.filter(draft => draft.ownerId === ownerId);
  const pending = ownedDrafts.filter(draft => draft.revision > draft.syncedRevision).length;
  useEffect(() => {
    if (!ownerId || !isOnline) return;
    const sync = () => {
      if (!pending) return;
      if (document.visibilityState === 'hidden') return;
      void syncCleanerWork(ownerId).then(() => {
        void client.invalidateQueries({ queryKey: ['cleaner-tasks', ownerId], refetchType: 'active' });
        void client.invalidateQueries({ queryKey: ['tasks'], refetchType: 'active' });
        void client.invalidateQueries({ queryKey: ['task-report'], refetchType: 'active' });
        void client.invalidateQueries({ queryKey: ['task-reports'], refetchType: 'active' });
      }).catch(() => undefined);
    };
    const timer = setTimeout(sync, 1_500);
    const interval = setInterval(sync, 30_000);
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', sync);
    return () => { clearTimeout(timer); clearInterval(interval); window.removeEventListener('online', sync); document.removeEventListener('visibilitychange', sync); };
  }, [ownerId, isOnline, pending, client]);

  return <CleanerOfflineContext.Provider value={ownerId ? {
    drafts: ownedDrafts, pending, pendingPhotos: ownedDrafts.length ? pendingPhotos : 0, isOnline, isSyncing, shellReady: shell.ready, shellError: shell.error,
    error: storageError || ownedDrafts.find(draft => draft.revision > draft.syncedRevision && draft.error)?.error || null,
    sync: () => syncCleanerWork(ownerId).catch(() => {
      setStorageError('No se ha podido confirmar el envío. Mantén la app abierta con cobertura y vuelve a intentarlo.');
    }),
  } : null}>{children}</CleanerOfflineContext.Provider>;
}
