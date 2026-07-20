// Feature flags y configuración de WhatsApp para Edge Functions (Deno).
// Modo PREPARACIÓN: si faltan los secrets o el flag está apagado, WhatsApp NO está
// "live" y las funciones entran en dry-run. Nunca se loguean valores de secrets.

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  appSecret: string;
  verifyToken: string;
  defaultCountryCode: string;
  graphApiVersion: string;
}

/**
 * Lee y normaliza la config efectiva de WhatsApp desde el entorno.
 * URL, Authorization, verificación GET y HMAC consumen exactamente estos
 * valores; no debe existir una validación trim() seguida de uso de datos crudos.
 * No la loguees nunca.
 */
export function getWhatsAppConfig(): WhatsAppConfig {
  return {
    accessToken: (Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '').trim(),
    phoneNumberId: (Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '').trim(),
    businessAccountId: (Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID') ?? '').trim(),
    appSecret: (Deno.env.get('WHATSAPP_APP_SECRET') ?? '').trim(),
    verifyToken: (Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '').trim(),
    defaultCountryCode: (Deno.env.get('WHATSAPP_DEFAULT_COUNTRY_CODE') ?? '').trim() || 'ES',
    graphApiVersion: (Deno.env.get('WHATSAPP_GRAPH_API_VERSION') ?? '').trim() || 'v21.0',
  };
}

/**
 * WhatsApp está "live" (envía de verdad a Meta) solo si:
 *  - el flag WHATSAPP_NOTIFICATIONS_ENABLED === 'true', y
 *  - existen WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID y
 *    WHATSAPP_APP_SECRET. Sin verificación de callbacks no se permite enviar.
 * En cualquier otro caso => modo preparación / dry-run.
 */
export function isWhatsAppLive(): boolean {
  const flag = (Deno.env.get('WHATSAPP_NOTIFICATIONS_ENABLED') ?? '').trim().toLowerCase();
  if (flag !== 'true') return false;
  const cfg = getWhatsAppConfig();
  return Boolean(cfg.accessToken && cfg.phoneNumberId && cfg.appSecret);
}

/** True si hay app secret configurado para validar firmas de webhook. */
export function hasWebhookSecret(): boolean {
  return Boolean(getWhatsAppConfig().appSecret);
}
