import { readLocal, type CleanerDraft } from './offlineStore';

// Browser storage can stop responding after suspension, even with working wifi/4G.
// Time out only the read: never abandon or retry a write whose result is unknown.
export async function readCleanerDraft(key: string, timeoutMs = 8_000): Promise<CleanerDraft | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      readLocal<CleanerDraft>('drafts', key),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('El guardado del móvil no responde. Pulsa Reintentar preparación. No borres los datos de la app: podrías perder trabajo pendiente.')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
