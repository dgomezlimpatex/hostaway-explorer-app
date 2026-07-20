import { useQuery } from '@tanstack/react-query';
import { rpcUntyped } from '@/lib/supabaseUntyped';

export const WHATSAPP_ERROR_STATUSES = ['failed', 'undeliverable'] as const;
export const WHATSAPP_UNCONFIRMED_MINUTES = 30;
export const WHATSAPP_MONITOR_DAYS = 7;

export interface WhatsAppDeliveryStats {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  unconfirmed: number;
  unresolved: number;
  callbackPending: number;
}

const emptyStats: WhatsAppDeliveryStats = {
  sent: 0,
  delivered: 0,
  read: 0,
  failed: 0,
  skipped: 0,
  unconfirmed: 0,
  unresolved: 0,
  callbackPending: 0,
};

export function useWhatsAppDeliveryHealth(enabled = true) {
  return useQuery({
    queryKey: ['whatsapp-delivery-health', WHATSAPP_MONITOR_DAYS],
    enabled,
    queryFn: async () => {
      const [statsResult, callbackResult] = await Promise.all([
        rpcUntyped('get_whatsapp_delivery_monitor_stats', { _days: WHATSAPP_MONITOR_DAYS }),
        rpcUntyped('get_whatsapp_webhook_pending_count', { _days: WHATSAPP_MONITOR_DAYS }),
      ]);
      if (statsResult.error) throw statsResult.error;
      if (callbackResult.error) throw callbackResult.error;
      const stats = (statsResult.data ?? {}) as unknown as Partial<WhatsAppDeliveryStats>;
      const callbackPending = Number(callbackResult.data ?? 0);
      const baseUnresolved = Number(stats.unresolved ?? 0);
      return {
        ...emptyStats,
        ...stats,
        unresolved: baseUnresolved + callbackPending,
        callbackPending,
      };
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
