import { readLocal, resetCleanerDatabase, type CleanerDraft } from './offlineStore';
import { withStorageTimeout } from './storageTimeout';

// Browser storage can stop responding after suspension, even with working wifi/4G.
// Time out the read and reopen storage. A write whose result is unknown is never retried automatically.
export async function readCleanerDraft(key: string, timeoutMs = 8_000): Promise<CleanerDraft | undefined> {
  return withStorageTimeout(readLocal<CleanerDraft>('drafts', key), timeoutMs,
    'El guardado del móvil no responde. Pulsa Reintentar preparación. No borres los datos de la app: podrías perder trabajo pendiente.', resetCleanerDatabase);
}
