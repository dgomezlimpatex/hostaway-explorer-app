import { normalizeSpanishPhoneE164 } from './normalizePhone';

export const WORKER_PHONE_VALIDATION_MESSAGE =
  'El teléfono debe ser un móvil español válido de 9 cifras, por ejemplo 698 157 788.';

/**
 * Normaliza el teléfono introducido en /workers antes de persistirlo.
 * Vacío sigue significando "sin teléfono"; un valor no vacío nunca se guarda
 * parcialmente ni en un formato que WhatsApp no pueda resolver.
 */
export function normalizeWorkerPhoneForStorage(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return '';
  const normalized = normalizeSpanishPhoneE164(trimmed);
  if (!normalized) throw new Error(WORKER_PHONE_VALIDATION_MESSAGE);
  return normalized;
}
