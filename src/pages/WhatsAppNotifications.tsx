import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCheck, ChevronLeft, ChevronRight, Clock3, Eye, RefreshCw, Search, Send, Smartphone, XCircle } from 'lucide-react';
import { rpcUntyped } from '@/lib/supabaseUntyped';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

  const total = Number(deliveries[0]?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const needsAttention = (stats?.failed ?? 0) + (stats?.skipped ?? 0) + (stats?.unconfirmed ?? 0);
  const refreshing = isFetching || statsFetching;
  const refreshAll = () => Promise.all([refetch(), refetchStats()]);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#310984]"><Smartphone className="h-6 w-6" />Notificaciones WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Últimos {WHATSAPP_MONITOR_DAYS} días. Estados reales recibidos desde Meta y actualización automática cada 30 segundos.</p>
        </div>
        <Button variant="outline" onClick={refreshAll} disabled={refreshing}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Actualizar</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric title="Enviados, sin entrega" value={stats?.sent ?? 0} tone="info" />
        <Metric title="Entregados" value={stats?.delivered ?? 0} tone="success" />
        <Metric title="Leídos" value={stats?.read ?? 0} tone="read" />
        <Metric title="Fallidos" value={stats?.failed ?? 0} tone="danger" />
        <Metric title="No enviados" value={stats?.skipped ?? 0} tone="warning" />
        <Metric title={`Sin confirmar +${WHATSAPP_UNCONFIRMED_MINUTES} min`} value={stats?.unconfirmed ?? 0} tone={(stats?.unconfirmed ?? 0) ? 'danger' : 'neutral'} />
      </div>

      {needsAttention > 0 && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-semibold">Hay WhatsApp que necesitan revisión</p><p className="text-sm">“Enviado” solo significa aceptado por Meta. Fallos, mensajes no enviados y envíos sin confirmación aparecen también en el contador del menú.</p></div>
        </div>
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
