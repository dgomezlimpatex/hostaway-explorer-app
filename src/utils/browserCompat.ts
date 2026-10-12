/**
 * Arranque seguro en móviles antiguos. Se ejecuta antes de montar React.
 * - Chrome < 92 no tiene crypto.randomUUID (se usa al iniciar tareas y guardar fotos).
 * - El traductor de Google sustituye nodos de texto y React falla al actualizarlos.
 * - Tras una publicación, los chunks antiguos dejan de existir y el import dinámico falla.
 */

const CHUNK_RELOAD_KEY = 'limpatex:chunk-reload-at';
const CHUNK_RELOAD_WINDOW_MS = 60_000;

export function randomUUIDFallback(getRandomValues: (bytes: Uint8Array) => Uint8Array): string {
  const bytes = getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function installRandomUUID(target: { crypto?: Crypto } = globalThis): void {
  const cryptoApi = target.crypto;
  if (!cryptoApi || typeof cryptoApi.randomUUID === 'function' || typeof cryptoApi.getRandomValues !== 'function') return;
  const generate = () => randomUUIDFallback(bytes => cryptoApi.getRandomValues(bytes)) as `${string}-${string}-${string}-${string}-${string}`;
  try {
    Object.defineProperty(cryptoApi, 'randomUUID', { value: generate, configurable: true, writable: true });
  } catch {
    // Un navegador que no permite ampliar crypto conserva el error visible de la operación.
  }
}

/** La página está en español: evita que Chrome ofrezca o aplique la traducción automática. */
export function protectFromTranslation(doc: Document = document): void {
  const root = doc.documentElement;
  root.lang = 'es';
  root.setAttribute('translate', 'no');
  root.classList.add('notranslate');
  if (!doc.head.querySelector('meta[name="google"]')) {
    const meta = doc.createElement('meta');
    meta.name = 'google';
    meta.content = 'notranslate';
    doc.head.appendChild(meta);
  }
}

/**
 * Si alguien traduce la página igualmente, los nodos que React esperaba ya no son hijos
 * del mismo padre. Sin esta protección React lanza NotFoundError y cae toda la pantalla.
 */
export function guardDomAgainstTranslation(nodePrototype: Node = Node.prototype): void {
  const proto = nodePrototype as Node & { __limpatexTranslationGuard?: boolean };
  if (proto.__limpatexTranslationGuard) return;
  proto.__limpatexTranslationGuard = true;
  const originalRemove = proto.removeChild;
  proto.removeChild = function removeChild<T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return originalRemove.call(this, child) as T;
  };
  const originalInsert = proto.insertBefore;
  proto.insertBefore = function insertBefore<T extends Node>(this: Node, node: T, reference: Node | null): T {
    if (reference && reference.parentNode !== this) return node;
    return originalInsert.call(this, node, reference) as T;
  };
}

export function isChunkLoadError(reason: unknown): boolean {
  const error = reason as { name?: string; message?: string } | null;
  const text = `${error?.name || ''} ${error?.message || (typeof reason === 'string' ? reason : '')}`;
  return /ChunkLoadError|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading (CSS )?chunk|Unable to preload CSS|is not a valid JavaScript MIME type/i.test(text);
}

/**
 * Recarga una sola vez por minuto para descargar la versión publicada.
 * Sin cobertura no recarga: el error se muestra y el trabajo guardado se conserva.
 */
export function reloadOnceForNewVersion(options: {
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  now?: number;
  online?: boolean;
  reload?: () => void;
} = {}): boolean {
  const storage = options.storage === undefined ? safeSessionStorage() : options.storage;
  const now = options.now ?? Date.now();
  const online = options.online ?? (typeof navigator === 'undefined' || navigator.onLine !== false);
  if (!storage || !online) return false;
  try {
    const last = Number(storage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (now - last < CHUNK_RELOAD_WINDOW_MS) return false;
    storage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  (options.reload || (() => window.location.reload()))();
  return true;
}

function safeSessionStorage(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

export function installBrowserCompat(): void {
  installRandomUUID();
  if (typeof document === 'undefined') return;
  protectFromTranslation();
  guardDomAgainstTranslation();
  // Vite emite este evento cuando no puede precargar un chunk de otra versión.
  window.addEventListener('vite:preloadError', event => {
    if (reloadOnceForNewVersion()) event.preventDefault();
  });
}
