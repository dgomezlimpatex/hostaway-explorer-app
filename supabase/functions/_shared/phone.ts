// Normalización de teléfonos a formato E.164 para WhatsApp.
// Los números nacionales sin prefijo se interpretan como españoles por defecto.

const COUNTRY_DIAL_CODES: Record<string, string> = {
  ES: '34',
};

function getDefaultDialCode(): string {
  const configuredCountry = typeof Deno !== 'undefined'
    ? Deno.env.get('WHATSAPP_DEFAULT_COUNTRY_CODE')
    : undefined;
  const cc = (configuredCountry ?? 'ES').toUpperCase();
  return COUNTRY_DIAL_CODES[cc] ?? '34';
}

/** Valida que una cadena ya esté en E.164 básico. */
export function isE164(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

/**
 * Normaliza teléfonos para WhatsApp:
 * - conserva prefijos internacionales explícitos (`+` o `00`);
 * - interpreta como español un móvil nacional de 9 cifras sin prefijo;
 * - devuelve null cuando el formato es ambiguo o no cumple E.164.
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

  if (hasInternational00Prefix) {
    value = value.slice(2);
  }

  if (hasPlusPrefix || hasInternational00Prefix) {
    const international = `+${value}`;
    return isE164(international) ? international : null;
  }

  const dial = getDefaultDialCode();
  if (value.length !== 9 || !/^[67]/.test(value)) return null;
  return `+${dial}${value}`;
}

/**
 * Alias conservado para los consumidores existentes.
 * También admite números internacionales cuando incluyen `+` o `00`.
 */
export const normalizeSpanishPhoneE164 = normalizePhoneE164;
