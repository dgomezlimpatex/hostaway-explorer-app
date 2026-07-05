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

/** Lee la config de WhatsApp desde el entorno. No la loguees nunca. */
export function getWhatsAppConfig(): WhatsAppConfig {
  return {
    accessToken: Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '',
    phoneNumberId: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '',
    businessAccountId: Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID') ?? '',
    appSecret: Deno.env.get('WHATSAPP_APP_SECRET') ?? '',
    verifyToken: Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '',
    defaultCountryCode: Deno.env.get('WHATSAPP_DEFAULT_COUNTRY_CODE') ?? 'ES',
    graphApiVersion: Deno.env.get('WHATSAPP_GRAPH_API_VERSION') ?? 'v21.0',
  };
}

/**
 * WhatsApp está "live" (envía de verdad a Meta) solo si:
 *  - el flag WHATSAPP_NOTIFICATIONS_ENABLED === 'true', y
 *  - existen WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID.
 * En cualquier otro caso => modo preparación / dry-run.
 */
export function isWhatsAppLive(): boolean {
  const flag = (Deno.env.get('WHATSAPP_NOTIFICATIONS_ENABLED') ?? '').trim().toLowerCase();
  if (flag !== 'true') return false;
  const cfg = getWhatsAppConfig();
  return Boolean(cfg.accessToken && cfg.phoneNumberId);
}

/** True si hay app secret configurado para validar firmas de webhook. */
export function hasWebhookSecret(): boolean {
  return Boolean((Deno.env.get('WHATSAPP_APP_SECRET') ?? '').trim());
}
