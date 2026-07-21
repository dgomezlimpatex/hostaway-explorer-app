// Normalización de teléfonos a E.164 (frontend).
// Espejo de supabase/functions/_shared/phone.ts.

const DEFAULT_DIAL_CODE = '34';

/** Valida E.164 básico. */
export function isE164(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

/**
 * Conserva prefijos internacionales explícitos y aplica +34 únicamente
 * a móviles nacionales españoles de nueve cifras sin prefijo.
 */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = String(raw).trim();
  if (!value) return null;

  const hasPlusPrefix = value.startsWith('+');
  const hasInternational00Prefix = value.startsWith('00');

  const allowedSyntax = hasPlusPrefix
    ? /^\+[\s().-]*[1-9][\d\s().-]*$/
    : hasInternational00Prefix
      ? /^00[\s().-]*[1-9][\d\s().-]*$/
      : /^[\d\s().-]+$/;
  if (!allowedSyntax.test(value)) return null;

  value = value.replace(/[^\d]/g, '');
  if (!value) return null;

  if (hasInternational00Prefix) value = value.slice(2);

  if (hasPlusPrefix || hasInternational00Prefix) {
    const international = `+${value}`;
    return isE164(international) ? international : null;
  }

  if (value.length !== 9 || !/^[67]/.test(value)) return null;
  return `+${DEFAULT_DIAL_CODE}${value}`;
}

/** Alias conservado para los consumidores existentes. */
export const normalizeSpanishPhoneE164 = normalizePhoneE164;
