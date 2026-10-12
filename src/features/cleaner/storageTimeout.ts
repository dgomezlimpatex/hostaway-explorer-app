/**
 * Bound how long the screen waits for the phone's storage. The write may still finish later;
 * the store notification then shows it. The screen must never stay blocked on "Guardando…".
 */
export async function withStorageTimeout<T>(operation: PromiseLike<T>, ms: number, message: string, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { onTimeout?.(); reject(new Error(message)); }, ms);
      }),
    ]);
  } finally { clearTimeout(timer); }
}
