import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Info,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  Trash2,
  XCircle,
} from 'lucide-react';
import { rpcUntyped } from '@/lib/supabaseUntyped';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  cleaner_name: string;
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

const isAttentionRow = (row: DeliveryRow) => (
  row.status === 'failed'
  || row.status === 'undeliverable'
  || row.status === 'skipped'
  || isUnconfirmed(row)
  || row.error_code === 'reconciliation_required'
);

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
  return (
    <Badge className={`${item.className} gap-1 border-0`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {item.label}
    </Badge>
  );
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
  const needsAttention = stats?.unresolved ?? 0;
  const trackedDeliveries = (stats?.sent ?? 0) + (stats?.delivered ?? 0) + (stats?.failed ?? 0) + (stats?.skipped ?? 0);
  const confirmationRate = trackedDeliveries > 0
    ? Math.round(((stats?.delivered ?? 0) / trackedDeliveries) * 100)
    : null;
  const refreshing = isFetching || statsFetching;

  const attentionItems = useMemo(() => [
    {
      key: 'failed',
      label: 'Fallidos',
      value: stats?.failed ?? 0,
      detail: 'Meta devolvió un error',
      filter: 'failed',
      icon: XCircle,
      tone: 'red',
    },
    {
      key: 'skipped',
      label: 'No enviados',
      value: stats?.skipped ?? 0,
      detail: 'El sistema decidió no enviar',
      filter: 'skipped',
      icon: AlertCircle,
      tone: 'amber',
    },
    {
      key: 'unconfirmed',
      label: 'Sin confirmar',
      value: stats?.unconfirmed ?? 0,
      detail: `Más de ${WHATSAPP_UNCONFIRMED_MINUTES} min sin entrega`,
      filter: 'attention',
      icon: Clock3,
      tone: 'amber',
    },
    {
      key: 'callbacks',
      label: 'Callbacks pendientes',
      value: stats?.callbackPending ?? 0,
      detail: 'Respuesta de Meta por conciliar',
      filter: null,
      icon: RefreshCw,
      tone: 'red',
    },
  ].filter((item) => item.value > 0), [stats]);

  const refreshAll = () => Promise.all([refetch(), refetchStats(), refetchQueue(), refetchSendQueue()]);

  const selectFilter = (nextFilter: string) => {
    setStatusFilter(nextFilter);
    setPage(0);
  };

  const requestSendResolution = async (
    row: SendReconciliationRow,
    resolution: 'confirmed_sent' | 'confirmed_not_sent',
  ) => {
    if (row.channel === 'whatsapp' && resolution === 'confirmed_not_sent') {
      toast.error('Un WhatsApp incierto no admite reintentos manuales: el backend limita el flujo a un máximo de 2 intentos y Meta no permite demostrar que un POST no produjo efecto.');
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

  const dismissSendResolution = async (row: SendReconciliationRow) => {
    if (!window.confirm('¿Eliminar esta decisión de la lista de pendientes? No se marcará como enviada ni se solicitará un reintento.')) {
      return;
    }

    setResolvingDeliveryId(row.delivery_id);
    try {
      const { error: dismissError } = await rpcUntyped('dismiss_notification_send_reconciliation', {
        _delivery_id: row.delivery_id,
      });
      if (dismissError) throw dismissError;
      toast.success('Decisión eliminada de pendientes');
      await refreshAll();
    } catch (dismissError) {
      toast.error(dismissError instanceof Error ? dismissError.message : 'No se pudo eliminar la decisión');
    } finally {
      setResolvingDeliveryId(null);
    }
  };

  return (
    <main className="min-h-full bg-[#f8f7fc] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#24104c] via-[#310984] to-[#0f766e] text-white shadow-[0_18px_45px_rgba(49,9,132,0.18)]">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/10" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-emerald-300/10" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 p-5 md:flex-row md:items-end md:justify-between md:p-7">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white/90">
                  <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                  Centro de actividad
                </span>
                {needsAttention > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-400/20 px-3 py-1.5 text-xs font-bold text-red-100">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    {needsAttention} requieren revisión
                  </span>
                )}
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] md:text-4xl">WhatsApp operativo</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75 md:text-base">
                Una lectura rápida de lo que se entregó, lo que falló y lo que todavía necesita una decisión.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-white/75">
                <span className="rounded-xl bg-black/15 px-3 py-2">Ventana: últimos {WHATSAPP_MONITOR_DAYS} días</span>
                <span className="rounded-xl bg-black/15 px-3 py-2">Actualización automática: 30 s</span>
              </div>
            </div>

            <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm md:w-80">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">Salud del canal</p>
                  <p className="mt-1 text-lg font-black">
                    {statsFetching && !stats ? 'Cargando…' : needsAttention > 0 ? 'Requiere revisión' : 'Todo en orden'}
                  </p>
                </div>
                {needsAttention > 0 ? (
                  <AlertCircle className="h-6 w-6 text-amber-200" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-6 w-6 text-emerald-200" aria-hidden="true" />
                )}
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/20" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-lime-200 transition-[width] duration-500"
                  style={{ width: `${confirmationRate ?? 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-white/65">
                {confirmationRate === null
                  ? 'Aún no hay actividad para calcular la tasa.'
                  : `${confirmationRate}% de las entregas están confirmadas por Meta.`}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen de actividad">
          <Metric
            icon={CheckCheck}
            title="Entregados"
            value={stats?.delivered ?? 0}
            detail="Meta confirmó la entrega"
            tone="success"
          />
          <Metric
            icon={Send}
            title="Enviados"
            value={stats?.sent ?? 0}
            detail="Aceptados, sin entrega confirmada"
            tone="info"
          />
          <Metric
            icon={XCircle}
            title="Fallidos"
            value={stats?.failed ?? 0}
            detail="Necesitan revisar el motivo"
            tone="danger"
          />
          <Metric
            icon={Clock3}
            title="Sin confirmar"
            value={stats?.unconfirmed ?? 0}
            detail={`Más de ${WHATSAPP_UNCONFIRMED_MINUTES} min sin respuesta`}
            tone={(stats?.unconfirmed ?? 0) > 0 ? 'warning' : 'neutral'}
          />
        </section>

        {statsFetching && !stats ? (
          <section className="rounded-2xl border border-[#e7e0f2] bg-white p-5 shadow-sm" role="status">
            <div className="flex items-center gap-3 text-sm text-[#6f6680]">
              <RefreshCw className="h-4 w-4 animate-spin text-[#6a42b6]" aria-hidden="true" />
              Cargando el estado real del canal…
            </div>
          </section>
        ) : needsAttention > 0 ? (
          <section className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-amber-50 p-5 shadow-sm" aria-labelledby="whatsapp-attention-title">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm">
                  <AlertCircle className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="whatsapp-attention-title" className="text-base font-black text-red-950">Requieren atención</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-5 text-red-900/75">
                    Hay eventos que no puedes dar por resueltos solo porque aparezcan como “Enviado”. Empieza por los fallidos y los que llevan demasiado tiempo sin confirmación.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 shrink-0 border-red-200 bg-white text-red-800 hover:bg-red-50"
                onClick={() => selectFilter('attention')}
              >
                Ver incidencias
                <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {attentionItems.map((item) => {
                const Icon = item.icon;
                const toneClasses = item.tone === 'red'
                  ? 'border-red-200 bg-white/75 text-red-900'
                  : 'border-amber-200 bg-white/75 text-amber-950';
                return item.filter ? (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => selectFilter(item.filter as string)}
                    className={`flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${toneClasses}`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-lg font-black tabular-nums">{item.value}</span>
                      <span className="block text-xs font-bold">{item.label}</span>
                      <span className="mt-0.5 block truncate text-[11px] opacity-70">{item.detail}</span>
                    </span>
                    <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                  </button>
                ) : (
                  <div key={item.key} className={`flex min-h-20 items-center gap-3 rounded-xl border p-3 ${toneClasses}`}>
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-lg font-black tabular-nums">{item.value}</span>
                      <span className="block text-xs font-bold">{item.label}</span>
                      <span className="mt-0.5 block truncate text-[11px] opacity-70">{item.detail}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm" role="status">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-black text-emerald-950">Canal estable</h2>
              <p className="mt-1 text-sm text-emerald-900/75">No hay fallos, envíos omitidos ni mensajes atascados en la ventana actual.</p>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-[#e5dcf2] bg-[#fbf9ff] p-5 shadow-sm" aria-labelledby="whatsapp-rules-title">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#6a42b6] shadow-sm">
              <Info className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="whatsapp-rules-title" className="text-base font-black text-[#332442]">Cómo leer estos estados</h2>
              <p className="mt-1 text-sm text-[#756b82]">La confirmación de Meta es la referencia para saber si el aviso llegó realmente.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Rule icon={Send} title="Enviado" detail="Meta aceptó la petición, pero todavía no confirma que llegara al teléfono." />
            <Rule icon={CheckCheck} title="Entregado" detail="Meta confirmó la entrega. Si aparece como leído, también cuenta como entregado." />
            <Rule icon={Clock3} title="Sin confirmar" detail={`Después de ${WHATSAPP_UNCONFIRMED_MINUTES} minutos conviene revisar el intento y su referencia.`} />
          </div>
        </section>

        {sendReconciliationQueue.length > 0 && (
          <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm" aria-labelledby="manual-reconciliation-title">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="manual-reconciliation-title" className="text-base font-black text-red-950">Decisiones pendientes</h2>
                <p className="mt-1 text-sm text-red-900/70">Comprueba el intento en Meta o Resend antes de confirmar qué ocurrió.</p>
              </div>
              <span className="ml-auto rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700">{sendReconciliationQueue.length}</span>
            </div>

            <div className="mt-4 space-y-3">
              {sendReconciliationQueue.map((row) => {
                const busy = resolvingDeliveryId === row.delivery_id || Boolean(row.open_action_status);
                return (
                  <article key={row.delivery_id} className="rounded-xl border border-red-100 bg-red-50/45 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="font-bold text-[#332442]">{row.channel === 'whatsapp' ? 'WhatsApp · Meta' : 'Fallback email · Resend'} · {row.recipient_masked}</p>
                        <p className="mt-1 text-xs leading-5 text-[#756b82]">{formatMadrid(row.created_at)} · {row.detail}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" className="min-h-11" variant="outline" disabled={busy} onClick={() => requestSendResolution(row, 'confirmed_sent')}>Confirmar enviado</Button>
                        {row.channel === 'email' && (
                          <Button size="sm" className="min-h-11" variant="destructive" disabled={busy} onClick={() => requestSendResolution(row, 'confirmed_not_sent')}>Confirmar no enviado y reintentar</Button>
                        )}
                        <Button
                          size="sm"
                          className="min-h-11 text-red-700 hover:bg-red-50 hover:text-red-800"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => dismissSendResolution(row)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                          Eliminar de pendientes
                        </Button>
                      </div>
                    </div>
                    {row.channel === 'whatsapp' && <p className="mt-3 rounded-lg bg-white/70 p-3 text-xs font-medium leading-5 text-red-800">El intento 1/2 incierto puede recibir un único reintento backend tras 15 minutos. Después del intento 2/2 no habrá un tercero. Solo puede confirmarse como enviado con el ID de Meta.</p>}
                    {row.open_action_status && <p className="mt-3 text-xs font-bold text-amber-700">Resolución encolada para el worker backend.</p>}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {reconciliationQueue.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm" aria-labelledby="callback-queue-title">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
                <RefreshCw className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="callback-queue-title" className="text-base font-black text-amber-950">Respuestas de Meta por conciliar</h2>
                <p className="mt-1 text-sm text-amber-900/75">Estos callbacks han llegado, pero todavía no se han asociado a un envío.</p>
              </div>
              <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-xs font-black text-amber-800">{reconciliationQueue.length}</span>
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-amber-200 bg-white/70">
              <table className="w-full min-w-[820px] text-sm">
                <thead><tr className="border-b border-amber-200 text-left text-xs uppercase tracking-wide text-amber-800/70"><th className="px-3 py-3">Recibido</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Trabajadora</th><th className="px-3 py-3">Referencia</th><th className="px-3 py-3">Remitente</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Intentos</th><th className="px-3 py-3">Detalle</th></tr></thead>
                <tbody>{reconciliationQueue.map((row, index) => <tr key={`${row.provider_message_ref}-${row.received_at}-${index}`} className="border-b border-amber-100 last:border-0"><td className="px-3 py-3">{formatMadrid(row.received_at)}</td><td className="px-3 py-3">{row.callback_kind === 'status' ? 'Estado' : 'Botón'}</td><td className="px-3 py-3 font-semibold text-amber-950">{row.cleaner_name || 'No identificada'}</td><td className="px-3 py-3">{row.provider_message_ref}</td><td className="px-3 py-3">{row.sender_masked}</td><td className="px-3 py-3 font-semibold">{row.callback_state === 'manual_review' ? 'Revisión manual' : 'Reintentando'}</td><td className="px-3 py-3">{row.attempts}</td><td className="max-w-xs px-3 py-3 text-xs text-amber-950/70">{row.detail}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-[#e5e0ec] bg-white shadow-sm" aria-labelledby="history-title">
          <div className="border-b border-[#eeeaf3] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="history-title" className="text-lg font-black text-[#332442]">Actividad reciente</h2>
                  {refreshing && <RefreshCw className="h-4 w-4 animate-spin text-[#6a42b6]" aria-label="Actualizando" />}
                </div>
                <p className="mt-1 text-sm text-[#756b82]">Busca por trabajadora, propiedad o tipo de aviso.</p>
              </div>
              <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={refreshAll} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                Actualizar ahora
              </Button>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#8e829d]" aria-hidden="true" />
                <Input className="min-h-11 border-[#e3dceb] pl-9" placeholder="Trabajadora, propiedad o aviso" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
              </div>
              <Select value={statusFilter} onValueChange={selectFilter}>
                <SelectTrigger className="min-h-11 w-full border-[#e3dceb] sm:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="attention">Requieren atención</SelectItem>
                  <SelectItem value="sent">Enviados</SelectItem>
                  <SelectItem value="delivered">Entregados</SelectItem>
                  <SelectItem value="read">Leídos</SelectItem>
                  <SelectItem value="failed">Fallidos</SelectItem>
                  <SelectItem value="skipped">No enviados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-4 md:p-5">
            {isLoading ? <LoadingHistory />
              : error ? <ErrorHistory onRetry={refreshAll} />
              : deliveries.length === 0 ? <EmptyHistory />
              : (
                <>
                  <div className="space-y-3 md:hidden">
                    {deliveries.map((row) => <DeliveryCard key={row.id} row={row} />)}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[920px] text-sm">
                      <thead><tr className="border-b border-[#eeeaf3] text-left text-xs uppercase tracking-wide text-[#8e829d]"><th className="pb-3">Estado</th><th className="pb-3">Trabajadora</th><th className="pb-3">Aviso</th><th className="pb-3">Propiedad</th><th className="pb-3">Último estado</th><th className="pb-3">Detalle</th></tr></thead>
                      <tbody>{deliveries.map((row) => (
                        <tr key={row.id} className={`border-b border-[#f0edf4] align-top last:border-0 ${isAttentionRow(row) ? 'bg-red-50/35' : ''}`}>
                          <td className="py-4 pr-3">{statusBadge(row.status)}{isUnconfirmed(row) && <p className="mt-1 text-xs font-bold text-amber-700">Sin confirmar</p>}</td>
                          <td className="py-4 pr-3"><p className="font-bold text-[#332442]">{row.cleaner_name || 'Sin identificar'}</p><p className="mt-0.5 text-xs text-[#8e829d]">{row.recipient_masked}</p></td>
                          <td className="py-4 pr-3 text-[#4d4359]">{eventLabels[row.event_type] ?? row.template_name ?? 'WhatsApp'}</td>
                          <td className="py-4 pr-3"><p className="text-[#4d4359]">{row.property || '—'}</p><p className="mt-0.5 text-xs text-[#8e829d]">{row.task_date || ''}</p></td>
                          <td className="py-4 pr-3 text-[#4d4359]">{formatMadrid(row.read_at ?? row.delivered_at ?? row.failed_at ?? row.sent_at ?? row.created_at)}</td>
                          <td className={`max-w-xs py-4 text-xs leading-5 ${isAttentionRow(row) ? 'font-semibold text-red-800' : 'text-[#756b82]'}`}>{row.error_detail || (row.provider_message_ref ? `Meta: ${row.provider_message_ref}` : '—')}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </>
              )}

            {(total > 0 || page > 0) && (
              <div className="mt-5 flex flex-col gap-3 border-t border-[#eeeaf3] pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[#756b82]">{total > 0 ? `${total} registros · página ${page + 1} de ${totalPages}` : 'Esta página ya no contiene registros'}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="min-h-11 flex-1 sm:flex-none" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}><ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />Anterior</Button>
                  <Button size="sm" variant="outline" className="min-h-11 flex-1 sm:flex-none" disabled={page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente<ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" /></Button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({
  icon: Icon,
  title,
  value,
  detail,
  tone,
}: {
  icon: typeof CheckCheck;
  title: string;
  value: number;
  detail: string;
  tone: 'success' | 'info' | 'neutral' | 'warning' | 'danger';
}) {
  const colors = {
    success: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-700' },
    info: { icon: 'bg-blue-50 text-blue-600', value: 'text-blue-700' },
    neutral: { icon: 'bg-slate-100 text-slate-600', value: 'text-slate-700' },
    warning: { icon: 'bg-amber-50 text-amber-600', value: 'text-amber-700' },
    danger: { icon: 'bg-red-50 text-red-600', value: 'text-red-700' },
  };
  const color = colors[tone];
  return (
    <article className="rounded-2xl border border-[#e8e2f0] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color.icon}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className={`text-3xl font-black tabular-nums ${color.value}`}>{value}</span>
      </div>
      <h3 className="mt-4 text-sm font-black text-[#332442]">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-[#8e829d]">{detail}</p>
    </article>
  );
}

function Rule({ icon: Icon, title, detail }: { icon: typeof Send; title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-[#e7dfef] bg-white/80 p-3">
      <div className="flex items-center gap-2 text-[#6a42b6]">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <h3 className="text-sm font-black text-[#332442]">{title}</h3>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#756b82]">{detail}</p>
    </div>
  );
}

function DeliveryCard({ row }: { row: DeliveryRow }) {
  const attention = isAttentionRow(row);
  return (
    <article className={`rounded-2xl border p-4 ${attention ? 'border-red-200 bg-red-50/35' : 'border-[#e8e2f0] bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-black text-[#332442]">{row.cleaner_name || 'Sin identificar'}</h3>
          <p className="mt-1 truncate text-xs text-[#756b82]">{row.property || 'Propiedad no identificada'}</p>
        </div>
        <div className="shrink-0 text-right">
          {statusBadge(row.status)}
          {isUnconfirmed(row) && <p className="mt-1 text-[11px] font-bold text-amber-700">Sin confirmar</p>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-[#faf8fd] px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#9a8eaa]">Aviso</p>
          <p className="mt-1 text-xs font-semibold text-[#4d4359]">{eventLabels[row.event_type] ?? row.template_name ?? 'WhatsApp'}</p>
        </div>
        <div className="rounded-xl bg-[#faf8fd] px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#9a8eaa]">Último estado</p>
          <p className="mt-1 text-xs font-semibold text-[#4d4359]">{formatMadrid(row.read_at ?? row.delivered_at ?? row.failed_at ?? row.sent_at ?? row.created_at)}</p>
        </div>
      </div>
      <div className={`mt-3 rounded-xl px-3 py-2.5 text-xs leading-5 ${attention ? 'bg-white/80 font-semibold text-red-800' : 'bg-[#faf8fd] text-[#756b82]'}`}>
        {row.error_detail || (row.provider_message_ref ? `Referencia de Meta: ${row.provider_message_ref}` : 'Sin detalle adicional')}
      </div>
      <p className="mt-3 text-xs text-[#9a8eaa]">Destino: {row.recipient_masked}{row.task_date ? ` · ${row.task_date}` : ''}</p>
    </article>
  );
}

function LoadingHistory() {
  return (
    <div className="space-y-3" role="status" aria-label="Cargando actividad">
      {[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-[#f2eef7]" />)}
    </div>
  );
}

function ErrorHistory({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <XCircle className="h-7 w-7 text-red-600" aria-hidden="true" />
      <p className="mt-3 text-sm font-black text-red-950">No se pudo cargar la actividad</p>
      <p className="mt-1 text-xs text-red-900/70">Comprueba la conexión y vuelve a intentarlo.</p>
      <Button type="button" variant="outline" className="mt-4 min-h-11 border-red-200 bg-white" onClick={onRetry}>Reintentar</Button>
    </div>
  );
}

function EmptyHistory() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#dcd2e8] bg-[#fbf9ff] p-8 text-center">
      <Search className="h-7 w-7 text-[#9c8caf]" aria-hidden="true" />
      <p className="mt-3 text-sm font-black text-[#332442]">No hay actividad con estos filtros</p>
      <p className="mt-1 text-xs text-[#756b82]">Prueba otro estado o limpia la búsqueda.</p>
    </div>
  );
}
