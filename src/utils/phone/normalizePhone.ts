// Normalización de teléfonos españoles a E.164 (frontend).
// Espejo de supabase/functions/_shared/phone.ts.

const DEFAULT_DIAL_CODE = '34';

/**
 * Convierte un teléfono español a E.164 (+34XXXXXXXXX) o devuelve null si es inválido.
 * Acepta: '600111222', '+34 600 111 222', '0034600111222'.
 * Rechaza: vacíos, longitudes inválidas, números que no empiezan por 6/7.
 */
export function normalizeSpanishPhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;

  const hadPlus = s.startsWith('+');
  s = s.replace(/[^\d]/g, '');
  if (!s) return null;

  if (s.startsWith('00')) {
    s = s.slice(2);
  } else if (hadPlus) {
    // viene con código de país tras el '+'
  }

  if (s.startsWith(DEFAULT_DIAL_CODE) && s.length > 9) {
    s = s.slice(DEFAULT_DIAL_CODE.length);
  }

  if (s.length !== 9) return null;
  if (!/^[67]/.test(s)) return null;

  return `+${DEFAULT_DIAL_CODE}${s}`;
}

/** Valida E.164 básico. */
export function isE164(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\+\d{8,15}$/.test(value.trim());
}
