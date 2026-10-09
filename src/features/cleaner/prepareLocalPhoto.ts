const UNREADABLE_PHOTO = 'No se ha podido leer la foto del móvil. Vuelve a seleccionarla desde Foto o Galería.';

/** Detach Android picker files from their temporary backing file before IndexedDB. */
export async function prepareLocalPhoto(file: Blob, mimeType: string): Promise<Blob> {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const copy = async () => {
    if (!file.size) throw new Error(UNREADABLE_PHOTO);
    const parts: Blob[] = [];
    // Avoid allocating a single 200 MB ArrayBuffer for an accepted video.
    const chunkSize = 2 * 1024 * 1024;
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, file.size);
      const bytes = await file.slice(offset, end).arrayBuffer();
      if (cancelled || bytes.byteLength !== end - offset) throw new Error(UNREADABLE_PHOTO);
      // Blob([file]) or file.slice() alone still retains the original backing file.
      parts.push(new Blob([bytes]));
    }
    return new Blob(parts, { type: mimeType });
  };
  try {
    return await Promise.race([
      copy(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { cancelled = true; reject(new Error(UNREADABLE_PHOTO)); }, 30_000);
      }),
    ]);
  } catch {
    throw new Error(UNREADABLE_PHOTO);
  } finally {
    cancelled = true;
    clearTimeout(timer);
  }
}

export function localPhotoErrorMessage(reason: unknown): string {
  const error = reason as { name?: string; message?: string } | null;
  if (error?.name === 'QuotaExceededError') return 'No hay espacio suficiente para guardar la foto en el móvil. Libera espacio sin borrar los datos de Limpatex y vuelve a adjuntarla.';
  if (/InvalidBlob|Failed to write blobs|NotReadableError/i.test(`${error?.name || ''} ${error?.message || ''}`)) return UNREADABLE_PHOTO;
  return error?.message || 'No se ha guardado la foto. Vuelve a adjuntarla desde Foto o Galería.';
}
