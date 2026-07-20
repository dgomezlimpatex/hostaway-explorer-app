import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCheck, ChevronLeft, ChevronRight, Clock3, Eye, RefreshCw, Search, Send, Smartphone, XCircle } from 'lucide-react';
import { rpcUntyped } from '@/lib/supabaseUntyped';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  WHATSAPP_MONITOR_DAYS,
  WHATSAPP_UNCONFIRMED_MINUTES,
  useWhatsAppDeliveryHealth,
} from '@/hooks/useWhatsAppDeliveryHealth';

const PAGE_SIZE = 50;

interface DeliveryRow {
  id: string;
  notification_event_id: string;
  provider_message_ref: string | null;
  recipient_masked: string;
  template_name: string | null;
  status: string;
  error_code: string | null;
  error_detail: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  created_at: string;
  event_type: string;
  cleaner_name: string | null;
  property: string | null;
  task_date: string | null;
  total_count: number;
}

interface SendReconciliationRow {
  delivery_id: string;
  notification_event_id: string;
  channel: 'whatsapp' | 'email';
  provider: string;
  recipient_masked: string;
  template_name: string | null;
  uncertainty_state: string;
  detail: string;
  created_at: string;
  open_action_status: string | null;
}

interface ReconciliationRow {
  callback_kind: string;
  provider_message_ref: string;
  sender_masked: string;
  callback_state: string;
  detail: string;
  attempts: number;
  received_at: string;
}

const eventLabels: Record<string, string> = {
  task_assigned: 'Tarea asignada',
  task_modified: 'Tarea modificada',
  task_cancelled: 'Asignación cancelada',
  task_approval_reminder: 'Recordatorio de aprobación',
  task_late_start_reminder: 'Recordatorio de inicio',
  task_rejected_alert: 'Alerta de rechazo',
  task_approved_confirmation: 'Confirmación de aceptación',
};

const isUnconfirmed = (row: DeliveryRow) => row.status === 'sent'
  && new Date(row.sent_at ?? row.created_at).getTime() < Date.now() - WHATSAPP_UNCONFIRMED_MINUTES * 60 * 1000;

const formatMadrid = (value?: string | null) => value
  ? new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short',
    }).format(new Date(value))
  : '—';

function statusBadge(status: string) {
  const config: Record<string, { label: string; className: string; icon: typeof Send }> = {
    queued: { label: 'Pendiente', className: 'bg-slate-100 text-slate-700', icon: Clock3 },
    sent: { label: 'Enviado', className: 'bg-blue-100 text-blue-700', icon: Send },
    delivered: { label: 'Entregado', className: 'bg-emerald-100 text-emerald-700', icon: CheckCheck },
    read: { label: 'Leído', className: 'bg-violet-100 text-violet-700', icon: Eye },
    failed: { label: 'Fallido', className: 'bg-red-100 text-red-700', icon: XCircle },
    undeliverable: { label: 'No entregable', className: 'bg-red-100 text-red-700', icon: XCircle },
    skipped: { label: 'No enviado', className: 'bg-amber-100 text-amber-800', icon: AlertCircle },
  };
  const item = config[status] ?? config.queued;
  const Icon = item.icon;
  return <Badge className={`${item.className} gap-1 border-0`}><Icon className="h-3 w-3" />{item.label}</Badge>;
}

export default function WhatsAppNotifications() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [resolvingDeliveryId, setResolvingDeliveryId] = useState<string | null>(null);
  const { data: stats, isFetching: statsFetching, refetch: refetchStats } = useWhatsAppDeliveryHealth(true);

  const { data: deliveries = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['whatsapp-notification-deliveries', WHATSAPP_MONITOR_DAYS, statusFilter, search.trim(), page],
    queryFn: async (): Promise<DeliveryRow[]> => {
      const { data, error: queryError } = await rpcUntyped('get_whatsapp_delivery_monitor', {
        _days: WHATSAPP_MONITOR_DAYS,
        _status: statusFilter,
        _search: search.trim(),
        _limit: PAGE_SIZE,
        _offset: page * PAGE_SIZE,
      });
      if (queryError) throw queryError;
      return (data ?? []) as unknown as DeliveryRow[];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: sendReconciliationQueue = [], refetch: refetchSendQueue } = useQuery({
    queryKey: ['notification-send-reconciliation-queue'],
    queryFn: async (): Promise<SendReconciliationRow[]> => {
      const { data, error: queryError } = await rpcUntyped('get_notification_send_reconciliation_queue', {
        _limit: 50,
      });
      if (queryError) throw queryError;
      return (data ?? []) as unknown as SendReconciliationRow[];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: reconciliationQueue = [], refetch: refetchQueue } = useQuery({
    queryKey: ['whatsapp-webhook-reconciliation-queue'],
    queryFn: async (): Promise<ReconciliationRow[]> => {
      const { data, error: queryError } = await rpcUntyped('get_whatsapp_webhook_reconciliation_queue', {
        _limit: 50,
      });
      if (queryError) throw queryError;
      return (data ?? []) as unknown as ReconciliationRow[];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const total = Number(deliveries[0]?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // `unresolved` ya agrega fallos, omitidos, envíos sin confirmar,
  // reconciliation_required y callbacks pendientes sin duplicarlos.
  const needsAttention = stats?.unresolved ?? 0;
  const refreshing = isFetching || statsFetching;
  const refreshAll = () => Promise.all([refetch(), refetchStats(), refetchQueue(), refetchSendQueue()]);

  const requestSendResolution = async (
    row: SendReconciliationRow,
    resolution: 'confirmed_sent' | 'confirmed_not_sent',
  ) => {
    if (row.channel === 'whatsapp' && resolution === 'confirmed_not_sent') {
      toast.error('Un WhatsApp incierto no se reenvía: Meta no permite demostrar que el primer POST no produjo efecto.');
      return;
    }
    const providerLabel = row.channel === 'whatsapp' ? 'Meta' : 'Resend';
    let providerMessageId: string | null = null;
    if (resolution === 'confirmed_sent') {
      providerMessageId = window.prompt(`Introduce el ID del mensaje confirmado en ${providerLabel}:`)?.trim() ?? null;
      if (!providerMessageId) return;
    } else if (!window.confirm(`Confirma que has comprobado en ${providerLabel} que este intento NO fue enviado. Se autorizará un único reintento backend.`)) {
      return;
    }

    setResolvingDeliveryId(row.delivery_id);
    try {
      const { error: requestError } = await rpcUntyped('request_notification_send_reconciliation', {
        _delivery_id: row.delivery_id,
        _resolution: resolution,
        _provider_message_id: providerMessageId,
      });
      if (requestError) throw requestError;
      toast.success('Resolución encolada para el worker backend');
      await refreshAll();
    } catch (resolutionError) {
      toast.error(resolutionError instanceof Error ? resolutionError.message : 'No se pudo encolar la resolución');
    } finally {
      setResolvingDeliveryId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#310984]"><Smartphone className="h-6 w-6" />Notificaciones WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Últimos {WHATSAPP_MONITOR_DAYS} días. Estados reales recibidos desde Meta y actualización automática cada 30 segundos.</p>
        </div>
        <Button variant="outline" onClick={refreshAll} disabled={refreshing}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Actualizar</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <Metric title="Enviados, sin entrega" value={stats?.sent ?? 0} tone="info" />
        <Metric title="Entregados" value={stats?.delivered ?? 0} tone="success" />
        <Metric title="Leídos" value={stats?.read ?? 0} tone="read" />
        <Metric title="Fallidos" value={stats?.failed ?? 0} tone="danger" />
        <Metric title="No enviados" value={stats?.skipped ?? 0} tone="warning" />
        <Metric title={`Sin confirmar +${WHATSAPP_UNCONFIRMED_MINUTES} min`} value={stats?.unconfirmed ?? 0} tone={(stats?.unconfirmed ?? 0) ? 'danger' : 'neutral'} />
        <Metric title="Callbacks por conciliar" value={stats?.callbackPending ?? 0} tone={(stats?.callbackPending ?? 0) ? 'danger' : 'neutral'} />
      </div>

      {needsAttention > 0 && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-semibold">Hay WhatsApp que necesitan revisión</p><p className="text-sm">“Enviado” solo significa aceptado por Meta. Fallos, mensajes no enviados y envíos sin confirmación aparecen también en el contador del menú.</p></div>
        </div>
      )}

      {sendReconciliationQueue.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-base text-red-900">Envíos pendientes de comprobación manual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Comprueba primero el intento en Meta o Resend. El sistema nunca reenvía automáticamente un resultado incierto.</p>
            {sendReconciliationQueue.map((row) => {
              const busy = resolvingDeliveryId === row.delivery_id || Boolean(row.open_action_status);
              return (
                <div key={row.delivery_id} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-medium">{row.channel === 'whatsapp' ? 'WhatsApp · Meta' : 'Fallback email · Resend'} · {row.recipient_masked}</p>
                      <p className="text-xs text-muted-foreground">{formatMadrid(row.created_at)} · {row.detail}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => requestSendResolution(row, 'confirmed_sent')}>Confirmar enviado</Button>
                      {row.channel === 'email' && (
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => requestSendResolution(row, 'confirmed_not_sent')}>Confirmar no enviado y reintentar</Button>
                      )}
                    </div>
                  </div>
                  {row.channel === 'whatsapp' && <p className="mt-2 text-xs font-medium text-red-700">WhatsApp incierto no se reenvía. Solo puede confirmarse como enviado con el ID de Meta; si no hay prueba, permanece en revisión para evitar duplicados.</p>}
                  {row.open_action_status && <p className="mt-2 text-xs font-medium text-amber-700">Resolución encolada para el worker backend.</p>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {reconciliationQueue.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader><CardTitle className="text-base text-amber-900">Cola de conciliación de Meta</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="pb-2">Recibido</th><th className="pb-2">Tipo</th><th className="pb-2">Referencia</th><th className="pb-2">Remitente</th><th className="pb-2">Estado</th><th className="pb-2">Intentos</th><th className="pb-2">Detalle</th></tr></thead>
              <tbody>{reconciliationQueue.map((row, index) => <tr key={`${row.provider_message_ref}-${row.received_at}-${index}`} className="border-b"><td className="py-3">{formatMadrid(row.received_at)}</td><td>{row.callback_kind === 'status' ? 'Estado' : 'Botón'}</td><td>{row.provider_message_ref}</td><td>{row.sender_masked}</td><td>{row.callback_state === 'manual_review' ? 'Revisión manual' : 'Reintentando'}</td><td>{row.attempts}</td><td className="max-w-xs text-xs text-muted-foreground">{row.detail}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>Historial de WhatsApp</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Trabajadora o propiedad" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></div>
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(0); }}><SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem><SelectItem value="attention">Requieren atención</SelectItem><SelectItem value="sent">Enviados</SelectItem><SelectItem value="delivered">Entregados</SelectItem><SelectItem value="read">Leídos</SelectItem><SelectItem value="failed">Fallidos</SelectItem><SelectItem value="skipped">No enviados</SelectItem>
            </SelectContent></Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Cargando WhatsApp…</p>
            : error ? <p className="py-8 text-center text-sm text-red-600">No se pudo cargar el historial de WhatsApp.</p>
            : deliveries.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No hay notificaciones con estos filtros.</p>
            : <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="pb-3">Estado</th><th className="pb-3">Trabajadora</th><th className="pb-3">Aviso</th><th className="pb-3">Propiedad</th><th className="pb-3">Último estado</th><th className="pb-3">Detalle</th></tr></thead><tbody>{deliveries.map((row) => (
              <tr key={row.id} className="border-b align-top"><td className="py-4">{statusBadge(row.status)}{isUnconfirmed(row) && <p className="mt-1 text-xs font-medium text-amber-700">Sin confirmar</p>}</td><td className="py-4"><p className="font-medium">{row.cleaner_name || 'Sin identificar'}</p><p className="text-xs text-muted-foreground">{row.recipient_masked}</p></td><td className="py-4">{eventLabels[row.event_type] ?? row.template_name ?? 'WhatsApp'}</td><td className="py-4"><p>{row.property || '—'}</p><p className="text-xs text-muted-foreground">{row.task_date || ''}</p></td><td className="py-4">{formatMadrid(row.read_at ?? row.delivered_at ?? row.failed_at ?? row.sent_at ?? row.created_at)}</td><td className="max-w-xs py-4 text-xs text-muted-foreground">{row.error_detail || (row.provider_message_ref ? `Meta: ${row.provider_message_ref}` : '—')}</td></tr>
            ))}</tbody></table></div>}

          {(total > 0 || page > 0) && (
            <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm">
              <span className="text-muted-foreground">{total > 0 ? `${total} registros · página ${page + 1} de ${totalPages}` : 'Esta página ya no contiene registros'}</span>
              <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}><ChevronLeft className="h-4 w-4" />Anterior</Button><Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente<ChevronRight className="h-4 w-4" /></Button></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ title, value, tone }: { title: string; value: number; tone: 'success' | 'info' | 'read' | 'neutral' | 'warning' | 'danger' }) {
  const colors = { success: 'text-emerald-700', info: 'text-blue-700', read: 'text-violet-700', neutral: 'text-slate-700', warning: 'text-amber-700', danger: 'text-red-700' };
  return <Card><CardContent className="pt-6"><p className={`text-3xl font-bold ${colors[tone]}`}>{value}</p><p className="text-sm text-muted-foreground">{title}</p></CardContent></Card>;
}
