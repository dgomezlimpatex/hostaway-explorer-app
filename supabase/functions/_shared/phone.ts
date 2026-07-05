// Normalización de teléfonos españoles a formato E.164 para WhatsApp.
// Espejo (Deno) de src/utils/phone/normalizePhone.ts.

const COUNTRY_DIAL_CODES: Record<string, string> = {
  ES: '34',
};

function getDefaultDialCode(): string {
  const cc = (Deno.env.get('WHATSAPP_DEFAULT_COUNTRY_CODE') ?? 'ES').toUpperCase();
  return COUNTRY_DIAL_CODES[cc] ?? '34';
}

/**
 * Convierte un teléfono español a E.164 (+34XXXXXXXXX) o devuelve null si es inválido.
 * Acepta: '600111222', '+34 600 111 222', '0034600111222', '+34600111222'.
 * Rechaza: vacíos, longitudes inválidas, móviles que no empiezan por 6/7.
 */
export function normalizeSpanishPhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // Conservar un posible '+' inicial; eliminar todo lo no numérico.
  const hadPlus = s.startsWith('+');
  s = s.replace(/[^\d]/g, '');
  if (!s) return null;

  const dial = getDefaultDialCode();

  // Prefijo internacional con 00 -> quitarlo.
  if (s.startsWith('00')) {
    s = s.slice(2);
  } else if (hadPlus) {
    // ya viene con código de país tras el '+'
  }

  // Si ya empieza por el código de país, quitarlo para validar el número nacional.
  if (s.startsWith(dial) && s.length > 9) {
    s = s.slice(dial.length);
  }

  // El número nacional español debe tener 9 dígitos.
  if (s.length !== 9) return null;

  // Móviles españoles: empiezan por 6 o 7. (Fijos 8/9 se rechazan para WhatsApp.)
  if (!/^[67]/.test(s)) return null;

  return `+${dial}${s}`;
}

/** Valida que una cadena ya esté en E.164 básico. */
export function isE164(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\+\d{8,15}$/.test(value.trim());
}
