import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronLeft, ChevronRight, ChevronRight as Arrow, Info, RefreshCw, Search, Smartphone, X } from 'lucide-react';
import { toast } from 'sonner';
import { rpcUntyped } from '@/lib/supabaseUntyped';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useWhatsAppDeliveryHealth } from '@/hooks/useWhatsAppDeliveryHealth';
import { WhatsAppDeliveryDetail } from '@/features/whatsapp-monitor/WhatsAppDeliveryDetail';
import { WhatsAppResolutionDialog, type ResolutionMode } from '@/features/whatsapp-monitor/WhatsAppResolutionDialog';
import { WhatsAppStatusBadge } from '@/features/whatsapp-monitor/WhatsAppStatusBadge';
import {
  PAGE_SIZE,
  PERIODS,
  PERIOD_LABELS,
  STATUS_FILTERS,
  UNCONFIRMED_MINUTES,
  activeChips,
  ageLabel,
  escapeLikePattern,
  eventLabel,
  failureLabel,
  formatClock,
  formatMoment,
  formatTaskDate,
  isForbidden,
  lastMoment,
  parseFilters,
  resendWindow,
  skipCause,
  uncertaintyLabel,
  writeFilters,
  type DeliveryRow,
  type MonitorFilters,
  type PeriodKey,
  type SendReconciliationRow,
  type StatusFilter,
  type WebhookReconciliationRow,
} from '@/features/whatsapp-monitor/whatsappMonitorModel';

const SEARCH_DEBOUNCE_MS = 300;

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Causa legible para la lista: no enviado, fallo o falta de entrega. */
function rowCause(row: DeliveryRow) {
  const cause = skipCause(row);
  if (cause) return cause.label;
  const failure = failureLabel(row);
  if (failure && row.status !== 'queued') return failure;
  if (row.status === 'queued' && row.error_code === 'reconciliation_required') return 'Reintento automático o comprobación manual';
  if (row.status === 'sent' && !row.delivered_at) return 'Entrega no comunicada';
  if (row.status === 'delivered') return 'Lectura no comunicada';
  return null;
}

function Unavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <span className="flex flex-col items-start gap-1">
      <span className="text-sm font-semibold text-red-700">No disponible</span>
      <button type="button" className="text-xs font-medium text-red-700 underline" onClick={onRetry}>Reintentar</button>
    </span>
  );
}

function AttentionChip({ label, value, onClick, tone = 'danger', hint }: {
  label: string; value: ReactNode; onClick?: () => void; tone?: 'danger' | 'warning' | 'neutral'; hint?: string;
}) {
  const colors = {
    danger: 'border-red-200 bg-red-50 text-red-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    neutral: 'border-slate-200 bg-white text-slate-800',
  }[tone];
  const content = (
    <>
      <span className="text-2xl font-bold tabular-nums leading-none">{value}</span>
      <span className="text-left text-xs font-medium leading-tight">{label}{hint && <span className="block font-normal opacity-80">{hint}</span>}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cn('flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 sm:min-w-[9.5rem] outline-none hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary', colors)}>
      {content}
    </button>
  ) : <div className={cn('flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 sm:min-w-[9.5rem]', colors)}>{content}</div>;
}

export default function WhatsAppNotifications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [searchText, setSearchText] = useState(filters.q);
  const debouncedSearch = useDebounced(searchText, SEARCH_DEBOUNCE_MS);
  const [resolution, setResolution] = useState<{ row: SendReconciliationRow; mode: ResolutionMode } | null>(null);
  const [selectedRow, setSelectedRow] = useState<DeliveryRow | null>(null);
  // En móvil las colas de administración se pliegan para no tapar el historial.
  const [queuesOpen, setQueuesOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const { userRole, userRoles } = useAuth();
  // Mismo criterio que el servidor (has_role admin), no el modo operativo.
  const isAdmin = userRoles.includes('admin') || userRole === 'admin';
  const days = PERIODS[filters.period];

  const updateFilters = useCallback((patch: Partial<MonitorFilters>, replace = false) => {
    setSearchParams((current) => writeFilters({ ...parseFilters(current), ...patch }, current), { replace });
  }, [setSearchParams]);

  // La búsqueda escrita se aplica a la URL tras una pausa; volver atrás la restaura.
  useEffect(() => {
    if (debouncedSearch.trim() !== filters.q.trim()) updateFilters({ q: debouncedSearch, page: 0 }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  useEffect(() => {
    if (filters.q.trim() !== debouncedSearch.trim()) setSearchText(filters.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q]);

  const health = useWhatsAppDeliveryHealth(true, days);
  const { stats, callbacks, breakdown } = health;

  const history = useQuery({
    queryKey: ['whatsapp-notification-deliveries', days, filters.status, filters.q.trim(), filters.page],
    queryFn: async (): Promise<DeliveryRow[]> => {
      const { data, error: queryError } = await rpcUntyped('get_whatsapp_delivery_monitor', {
        _days: days,
        _status: filters.status,
        _search: escapeLikePattern(filters.q),
        _limit: PAGE_SIZE,
        _offset: filters.page * PAGE_SIZE,
      });
      if (queryError) throw queryError;
      return (data ?? []) as unknown as DeliveryRow[];
    },
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const sendQueue = useQuery({
    queryKey: ['notification-send-reconciliation-queue'],
    queryFn: async (): Promise<SendReconciliationRow[]> => {
      const { data, error: queryError } = await rpcUntyped('get_notification_send_reconciliation_queue', { _limit: 50 });
      if (queryError) throw queryError;
      return (data ?? []) as unknown as SendReconciliationRow[];
    },
    enabled: isAdmin,
    retry: (count, error) => !isForbidden(error) && count < 2,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const webhookQueue = useQuery({
    queryKey: ['whatsapp-webhook-reconciliation-queue'],
    queryFn: async (): Promise<WebhookReconciliationRow[]> => {
      const { data, error: queryError } = await rpcUntyped('get_whatsapp_webhook_reconciliation_queue', { _limit: 50 });
      if (queryError) throw queryError;
      return (data ?? []) as unknown as WebhookReconciliationRow[];
    },
    enabled: isAdmin,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const deliveries = history.data ?? [];
  const total = Number(deliveries[0]?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sendRows = sendQueue.data ?? [];
  const webhookRows = webhookQueue.data ?? [];
  const showQueues = isAdmin && (sendRows.length > 0 || webhookRows.length > 0 || sendQueue.isError || webhookQueue.isError);
  const queueByDelivery = useMemo(() => new Map((sendQueue.data ?? []).map((row) => [row.delivery_id, row])), [sendQueue.data]);

  const refreshing = history.isFetching || stats.isFetching || callbacks.isFetching || sendQueue.isFetching || webhookQueue.isFetching;
  const refreshAll = () => Promise.all([
    history.refetch(), health.refetch(),
    ...(isAdmin ? [sendQueue.refetch(), webhookQueue.refetch()] : []),
  ]);
  const lastUpdated = Math.max(history.dataUpdatedAt, stats.dataUpdatedAt);

  const failedBlocks = [
    stats.isError && 'resumen',
    callbacks.isError && isAdmin && 'callbacks de Meta',
    history.isError && 'historial',
    sendQueue.isError && !isForbidden(sendQueue.error) && 'envíos por comprobar',
    webhookQueue.isError && 'cola de Meta',
  ].filter(Boolean) as string[];

  // Detalle: la fila se conserva aunque el sondeo la saque de la página actual.
  const detailId = filters.delivery;
  const rowFromPage = detailId ? deliveries.find((row) => row.id === detailId) ?? null : null;
  useEffect(() => {
    if (!detailId) setSelectedRow(null);
    else if (rowFromPage) setSelectedRow(rowFromPage);
  }, [detailId, rowFromPage]);
  const detailRow = rowFromPage ?? (selectedRow?.id === detailId ? selectedRow : null);
  const openDetail = (id: string) => updateFilters({ delivery: id });
  const closeDetail = () => updateFilters({ delivery: null });

  const applyStatus = (status: StatusFilter) => {
    updateFilters({ status, page: 0 });
    historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submitResolution = async (row: SendReconciliationRow, mode: ResolutionMode, providerMessageId: string | null) => {
    if (row.channel === 'whatsapp' && mode === 'confirmed_not_sent') throw new Error('whatsapp_uncertain_cannot_be_reopened');
    const { error: requestError } = await rpcUntyped('request_notification_send_reconciliation', {
      _delivery_id: row.delivery_id,
      _resolution: mode,
      _provider_message_id: providerMessageId,
    });
    if (requestError) throw requestError;
    toast.success('Resolución encolada: el servidor la aplicará en el próximo ciclo.');
    await refreshAll();
  };

  const statsValue = (value: number | undefined) => (stats.data ? value ?? 0 : stats.isError
    ? <Unavailable onRetry={() => void stats.refetch()} />
    : <span aria-label="Cargando" className="inline-block h-6 w-8 animate-pulse rounded bg-current opacity-20" />);
  const deliveryAttention = breakdown?.total;
  const callbackPending = callbacks.data;
  const periodLabel = PERIOD_LABELS[filters.period].toLowerCase();
  const chips = activeChips(filters);

  return (
    <div className="space-y-5 p-4 md:p-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#310984]"><Smartphone aria-hidden className="h-6 w-6" />Notificaciones WhatsApp</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Avisos automáticos a trabajadoras. «Aceptado» significa aceptado por Meta; Entregado y Leído solo aparecen si Meta lo comunica.
            <span className="hidden sm:inline"> El modo del canal (activo o preparación) no se comprueba desde esta pantalla: los avisos registrados en modo preparación se marcan como tales.</span>
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 md:items-end">
          <Button variant="outline" onClick={() => void refreshAll()} disabled={refreshing}><RefreshCw aria-hidden className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />Actualizar</Button>
          <p className="text-xs text-muted-foreground">{lastUpdated ? `Actualizado ${formatClock(lastUpdated)} · cada 30 s` : 'Cargando…'}</p>
        </div>
      </header>

      {failedBlocks.length > 0 && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex gap-2 text-sm"><AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>No se pudieron cargar algunos datos</strong> ({failedBlocks.join(', ')}). Lo que no se pudo comprobar aparece como «No disponible», nunca como 0.</span></p>
          <Button size="sm" variant="outline" className="border-red-300 bg-white" onClick={() => void refreshAll()}>Reintentar</Button>
        </div>
      )}

      <section aria-labelledby="wa-attention" className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="wa-attention" className="text-base font-semibold">Necesitan acción <span className="font-normal text-muted-foreground">· {periodLabel}</span></h2>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {deliveryAttention === undefined ? (stats.isError ? 'Total no disponible' : 'Cargando…') : `${deliveryAttention} avisos en total`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <AttentionChip label="Fallidos" value={statsValue(breakdown?.failed)} onClick={() => applyStatus('failed')} />
          <AttentionChip label="Inciertos" hint="intento 1/2" value={statsValue(breakdown?.uncertain)} onClick={() => applyStatus('queued')} />
          <AttentionChip label={`Sin confirmar +${UNCONFIRMED_MINUTES} min`} value={statsValue(breakdown?.unconfirmed)} onClick={() => applyStatus('sent')} tone="warning" />
          <AttentionChip label="No enviados" hint="incluye modo preparación y falta de teléfono" value={statsValue(breakdown?.skipped)} onClick={() => applyStatus('skipped')} tone="warning" />
        </div>
        <p className="text-xs text-muted-foreground">
          Estas cifras son las que suma el contador del menú. «No enviados» aún incluye avisos esperados (modo preparación); la causa de cada uno se ve en el historial.
        </p>
        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
            <span className="font-medium">Conciliación de Meta (solo administración):</span>
            {callbackPending !== undefined
              ? <span>{callbackPending} callbacks sin correlacionar{callbackPending > 0 && ' · pueden corresponder a un aviso incierto ya contado arriba, por eso no se suman'}</span>
              : callbacks.isError ? <Unavailable onRetry={() => void callbacks.refetch()} /> : <span className="text-muted-foreground">Cargando…</span>}
          </div>
        ) : (
          <p className="flex gap-2 border-t pt-3 text-sm text-muted-foreground"><Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />Las colas de comprobación manual y de conciliación con Meta son solo de administración; aquí no se muestran sus cifras.</p>
        )}

        <div className="border-t pt-3">
          <h3 className="mb-1 text-sm font-semibold">Progreso <span className="font-normal text-muted-foreground">· {periodLabel}</span></h3>
          {stats.data ? (
            <p className="text-sm">
              <span className="font-semibold tabular-nums">{stats.data.sent}</span> aceptados por Meta sin entrega comunicada ·{' '}
              <span className="font-semibold tabular-nums">{stats.data.delivered}</span> entregados, de los cuales <span className="font-semibold tabular-nums">{stats.data.read}</span> leídos
            </p>
          ) : stats.isError ? <Unavailable onRetry={() => void stats.refetch()} /> : <p className="text-sm text-muted-foreground">Cargando…</p>}
        </div>
      </section>

      {showQueues && (
        <button
          type="button"
          aria-expanded={queuesOpen}
          aria-controls="wa-queues"
          onClick={() => setQueuesOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-900 outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
        >
          <span>{[sendRows.length > 0 && `${sendRows.length} envíos por comprobar`, webhookRows.length > 0 && `${webhookRows.length} respuestas de Meta`, (sendQueue.isError || webhookQueue.isError) && 'colas sin comprobar'].filter(Boolean).join(' · ')}</span>
          <span className="text-xs underline">{queuesOpen ? 'Ocultar' : 'Ver'}</span>
        </button>
      )}

      <div id="wa-queues" className={cn('space-y-5', !queuesOpen && 'hidden md:block')}>
      {isAdmin && (sendRows.length > 0 || sendQueue.isError) && (
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-red-900">Envíos pendientes de comprobación manual{sendRows.length > 0 && ` (${sendRows.length})`}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sendQueue.isError && !isForbidden(sendQueue.error) && (
              <p role="alert" className="text-sm text-red-700">No se pudo comprobar la cola. <button type="button" className="underline" onClick={() => void sendQueue.refetch()}>Reintentar</button></p>
            )}
            {sendQueue.isError && isForbidden(sendQueue.error) && <p className="text-sm text-muted-foreground">Esta cola es solo de administración.</p>}
            {sendRows.length > 0 && <p className="text-sm text-muted-foreground">Comprueba primero el intento en Meta o Resend. WhatsApp aplica como máximo un reintento automático 2/2 tras 15 minutos; Resend solo reutiliza su clave dentro de la ventana segura.</p>}
            {sendRows.map((row) => {
              const uncertainty = uncertaintyLabel(row.uncertainty_state);
              const safeWindow = resendWindow(row.created_at);
              const busy = Boolean(row.open_action_status);
              return (
                <div key={row.delivery_id} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{row.channel === 'whatsapp' ? 'WhatsApp · Meta' : 'Email alternativo · Resend'} · {row.recipient_masked}</p>
                      <p className="text-xs text-muted-foreground">{formatMoment(row.created_at)} ({ageLabel(row.created_at)}) · <strong>{uncertainty.label}</strong> · {row.detail}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openDetail(row.delivery_id)}>Ver detalle</Button>
                      <Button size="sm" variant="outline" disabled={busy || !uncertainty.canConfirm} onClick={() => setResolution({ row, mode: 'confirmed_sent' })}>Confirmar enviado…</Button>
                      {row.channel === 'email' && !safeWindow.expired && (
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => setResolution({ row, mode: 'confirmed_not_sent' })}>Confirmar no enviado…</Button>
                      )}
                    </div>
                  </div>
                  {row.channel === 'whatsapp' && <p className="mt-2 text-xs font-medium text-red-700">El intento 1/2 incierto puede recibir un único reintento backend tras 15 minutos. Después del intento 2/2 no habrá un tercero. Solo puede confirmarse como enviado con el ID de Meta.</p>}
                  {row.channel === 'whatsapp' && !uncertainty.canConfirm && <p className="mt-1 text-xs text-amber-800">{uncertainty.explanation}</p>}
                  {row.channel === 'email' && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {safeWindow.expired
                        ? 'Ventana de reintento probablemente vencida (más de 23 h desde la creación): ya no se ofrece reintentar. Comprueba en Resend y confirma como enviado si salió.'
                        : `Ventana de reintento: quedan unas ${safeWindow.remainingHours} h (estimada desde la creación del envío).`}
                    </p>
                  )}
                  {row.open_action_status && <p className="mt-2 text-xs font-medium text-amber-700">Resolución encolada para el servidor.</p>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {isAdmin && (webhookRows.length > 0 || webhookQueue.isError) && (
        <Card className="border-amber-200">
          <CardHeader className="pb-3"><CardTitle className="text-base text-amber-900">Cola de conciliación de Meta{webhookRows.length > 0 && ` (${webhookRows.length})`}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {webhookQueue.isError && <p role="alert" className="text-sm text-red-700">No se pudo comprobar la cola de Meta. <button type="button" className="underline" onClick={() => void webhookQueue.refetch()}>Reintentar</button></p>}
            {webhookRows.length > 0 && (
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">Respuestas de Meta pendientes de correlacionar con un aviso</caption>
                <thead><tr className="border-b text-left text-muted-foreground"><th scope="col" className="pb-2">Recibido</th><th scope="col" className="pb-2">Tipo</th><th scope="col" className="pb-2">Referencia</th><th scope="col" className="pb-2">Remitente</th><th scope="col" className="pb-2">Estado</th><th scope="col" className="pb-2">Intentos</th><th scope="col" className="pb-2">Detalle</th></tr></thead>
                <tbody>{webhookRows.map((row, index) => <tr key={`${row.provider_message_ref}-${row.received_at}-${index}`} className="border-b"><td className="py-3">{formatMoment(row.received_at)}</td><td>{row.callback_kind === 'status' ? 'Estado' : 'Botón'}</td><td>{row.provider_message_ref}</td><td>{row.sender_masked}</td><td>{row.callback_state === 'manual_review' ? 'Revisión manual' : 'Reintentando'}</td><td>{row.attempts}</td><td className="max-w-xs text-xs text-muted-foreground">{row.detail}</td></tr>)}</tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      </div>

      <Card ref={historyRef} className="scroll-mt-4">
        <CardHeader className="space-y-3 pb-3">
          <CardTitle id="wa-history">Historial de WhatsApp</CardTitle>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_13rem]">
            <div className="space-y-1">
              <Label htmlFor="wa-search" className="text-xs text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search aria-hidden className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input id="wa-search" type="search" className="pl-9" placeholder="Trabajadora, propiedad o plantilla" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wa-period" className="text-xs text-muted-foreground">Periodo</Label>
              <Select value={filters.period} onValueChange={(value) => updateFilters({ period: value as PeriodKey, page: 0 })}>
                <SelectTrigger id="wa-period" aria-label="Periodo"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((key) => <SelectItem key={key} value={key}>{PERIOD_LABELS[key]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wa-status" className="text-xs text-muted-foreground">Estado</Label>
              <Select value={filters.status} onValueChange={(value) => updateFilters({ status: value as StatusFilter, page: 0 })}>
                <SelectTrigger id="wa-status" aria-label="Estado"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(STATUS_FILTERS) as StatusFilter[]).map((key) => <SelectItem key={key} value={key}>{STATUS_FILTERS[key]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                aria-label={`Quitar filtro ${chip.label}`}
                className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => {
                  if (chip.key === 'q') setSearchText('');
                  updateFilters(chip.key === 'period' ? { period: '7d', page: 0 } : chip.key === 'status' ? { status: 'all', page: 0 } : { q: '', page: 0 });
                }}
              >
                {chip.label}<X aria-hidden className="h-3 w-3" />
              </button>
            ))}
            {chips.length > 1 && <button type="button" className="text-xs font-medium text-primary underline" onClick={() => { setSearchText(''); updateFilters({ period: '7d', status: 'all', q: '', page: 0 }); }}>Quitar todo</button>}
            <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
              {history.isSuccess ? `${total} avisos · página ${Math.min(filters.page + 1, totalPages)} de ${totalPages}` : ''}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {history.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Cargando WhatsApp…</p>
            : history.isError && deliveries.length === 0 ? (
              <div role="alert" className="py-8 text-center text-sm text-red-700">
                <p>No se pudo cargar el historial de WhatsApp.</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => void history.refetch()}>Reintentar</Button>
              </div>
            )
            : deliveries.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No hay avisos con estos filtros en {periodLabel}.</p>
            : (
              <>
                <ul className="space-y-2 md:hidden" aria-label="Avisos de WhatsApp">
                  {deliveries.map((row) => {
                    const moment = lastMoment(row);
                    const cause = rowCause(row);
                    return (
                      <li key={row.id}>
                        <button type="button" onClick={() => openDetail(row.id)} className="w-full rounded-xl border p-3 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary">
                          <span className="flex items-start justify-between gap-2"><WhatsAppStatusBadge row={row} /><span className="text-xs text-muted-foreground">{moment.verb} {formatMoment(moment.at)}</span></span>
                          <span className="mt-1 block font-medium">{row.cleaner_name || 'Destinatario sin identificar'} <span className="font-normal text-muted-foreground">{row.recipient_masked}</span></span>
                          <span className="block text-sm">{eventLabel(row)}</span>
                          <span className="block text-xs text-muted-foreground">{[row.property, formatTaskDate(row.task_date)].filter(Boolean).join(' · ') || 'Sin tarea asociada'}</span>
                          {cause && <span className="mt-1 flex items-center justify-between text-xs font-medium">{cause}<Arrow aria-hidden className="h-3.5 w-3.5" /></span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Historial de avisos de WhatsApp, {periodLabel}. Pulsa un aviso para ver su detalle.</caption>
                    <thead><tr className="border-b text-left text-muted-foreground"><th scope="col" className="pb-3">Estado</th><th scope="col" className="pb-3">Destinatario</th><th scope="col" className="pb-3">Aviso · tarea</th><th scope="col" className="pb-3">Cuándo</th><th scope="col" className="pb-3">Causa</th><th scope="col" className="pb-3"><span className="sr-only">Detalle</span></th></tr></thead>
                    <tbody>{deliveries.map((row) => {
                      const moment = lastMoment(row);
                      const inQueue = queueByDelivery.has(row.id);
                      return (
                        <tr key={row.id} className={cn('border-b align-top', detailId === row.id && 'bg-muted/50')}>
                          <td className="py-3"><WhatsAppStatusBadge row={row} /></td>
                          <td className="py-3"><p className="font-medium">{row.cleaner_name || 'Destinatario sin identificar'}</p><p className="text-xs text-muted-foreground">{row.recipient_masked}</p></td>
                          <td className="py-3"><p>{eventLabel(row)}</p><p className="text-xs text-muted-foreground">{[row.property, formatTaskDate(row.task_date)].filter(Boolean).join(' · ') || 'Sin tarea asociada'}</p></td>
                          <td className="py-3 whitespace-nowrap">{moment.verb} {formatMoment(moment.at)}</td>
                          <td className="max-w-xs py-3 text-xs">{rowCause(row) ?? '—'}{inQueue && <p className="font-medium text-red-700">En la cola de comprobación manual</p>}</td>
                          <td className="py-3 text-right"><Button size="sm" variant="ghost" aria-label={`Ver detalle de ${eventLabel(row)} a ${row.cleaner_name || 'destinatario sin identificar'}`} onClick={() => openDetail(row.id)}>Ver<Arrow aria-hidden className="ml-1 h-3.5 w-3.5" /></Button></td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
                {history.isError && <p role="alert" className="mt-2 text-xs text-red-700">La última actualización falló; se muestran los datos anteriores. <button type="button" className="underline" onClick={() => void history.refetch()}>Reintentar</button></p>}
              </>
            )}

          {(total > 0 || filters.page > 0) && (
            <nav aria-label="Paginación del historial" className="mt-4 flex items-center justify-between border-t pt-4 text-sm">
              <span className="text-muted-foreground">{total > 0 ? `Página ${filters.page + 1} de ${totalPages}` : 'Esta página ya no contiene registros'}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={filters.page === 0} onClick={() => updateFilters({ page: Math.max(0, filters.page - 1) })}><ChevronLeft aria-hidden className="h-4 w-4" />Anterior</Button>
                <Button size="sm" variant="outline" disabled={filters.page + 1 >= totalPages} onClick={() => updateFilters({ page: filters.page + 1 })}>Siguiente<ChevronRight aria-hidden className="h-4 w-4" /></Button>
              </div>
            </nav>
          )}
        </CardContent>
      </Card>

      <WhatsAppDeliveryDetail
        deliveryId={detailId}
        row={detailRow}
        queueRow={detailId ? queueByDelivery.get(detailId) ?? null : null}
        isAdmin={isAdmin}
        onClose={closeDetail}
        onResolve={(row, mode) => setResolution({ row, mode })}
      />
      <WhatsAppResolutionDialog
        row={resolution?.row ?? null}
        mode={resolution?.mode ?? 'confirmed_sent'}
        onClose={() => setResolution(null)}
        onSubmit={submitResolution}
      />
    </div>
  );
}
