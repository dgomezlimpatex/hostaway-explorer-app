// Configuración de cliente para notificaciones WhatsApp (frontend).
// Feature flag APAGADO por defecto: con el flag off, la app se comporta
// exactamente igual que hoy (emails). Nada se envía por WhatsApp.

/**
 * True solo si VITE_WHATSAPP_NOTIFICATIONS_ENABLED === 'true'.
 * Por defecto false => modo preparación.
 */
export function isWhatsAppNotificationsEnabled(): boolean {
  const flag = (import.meta.env.VITE_WHATSAPP_NOTIFICATIONS_ENABLED ?? '').toString().trim().toLowerCase();
  return flag === 'true';
}
