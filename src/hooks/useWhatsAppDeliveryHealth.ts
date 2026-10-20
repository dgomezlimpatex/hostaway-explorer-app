import { useQuery } from '@tanstack/react-query';
import { rpcUntyped } from '@/lib/supabaseUntyped';
import {
  attentionBreakdown,
  menuAttentionCount,
  parseStats,
  type DeliveryStats,
} from '@/features/whatsapp-monitor/whatsappMonitorModel';

export const WHATSAPP_ERROR_STATUSES = ['failed', 'undeliverable'] as const;
export const WHATSAPP_UNCONFIRMED_MINUTES = 30;
export const WHATSAPP_MONITOR_DAYS = 7;

export type WhatsAppDeliveryStats = DeliveryStats;

/**
 * Resumen y callbacks pendientes en dos consultas independientes: si una falla,
 * la otra sigue visible y el fallo no se confunde con «0 pendientes».
 */
export function useWhatsAppDeliveryHealth(enabled = true, days = WHATSAPP_MONITOR_DAYS) {
  const stats = useQuery({
    queryKey: ['whatsapp-delivery-health', 'stats', days],
    enabled,
    queryFn: async (): Promise<DeliveryStats> => {
      const { data, error } = await rpcUntyped('get_whatsapp_delivery_monitor_stats', { _days: days });
      if (error) throw error;
      return parseStats(data);
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const callbacks = useQuery({
    queryKey: ['whatsapp-delivery-health', 'callbacks', days],
    enabled,
    queryFn: async (): Promise<number> => {
      const { data, error } = await rpcUntyped('get_whatsapp_webhook_pending_count', { _days: days });
      if (error) throw error;
      const value = Number(data ?? 0);
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const breakdown = stats.data ? attentionBreakdown(stats.data) : null;
  const deliveryAttention = stats.data?.unresolved;
  const callbackPending = callbacks.data;
  // Sin dato no hay número: el menú muestra «!» en lugar de ocultar el aviso.
  const unavailable = enabled && (
    (stats.isError && stats.data === undefined) || (callbacks.isError && callbacks.data === undefined)
  );
  const menuCount = menuAttentionCount(deliveryAttention ?? 0, callbackPending ?? 0);

  return {
    stats,
    callbacks,
    breakdown,
    menuCount,
    unavailable,
    refetch: () => Promise.all([stats.refetch(), callbacks.refetch()]),
  };
}
