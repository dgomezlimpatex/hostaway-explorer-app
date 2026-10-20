import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { rpcUntyped } from '@/lib/supabaseUntyped';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { WhatsAppStatusBadge } from './WhatsAppStatusBadge';
import {
  attemptStateLabel,
  basicTimeline,
  eventLabel,
  failureLabel,
  formatMoment,
  formatTaskDate,
  isMissingRpc,
  skipCause,
  statusInfo,
  uncertaintyLabel,
  type DeliveryAttemptRow,
  type DeliveryRow,
  type ManualActionRow,
  type SendReconciliationRow,
  type TimelineEntry,
} from './whatsappMonitorModel';

interface DetailPayload {
  attempts: DeliveryAttemptRow[];
  actions: ManualActionRow[] | null;
  recipient_name_snapshot: string | null;
  snapshot_property: string | null;
  snapshot_task_date: string | null;
}

interface Props {
  deliveryId: string | null;
  row: DeliveryRow | null;
  queueRow: SendReconciliationRow | null;
  isAdmin: boolean;
  onClose: () => void;
  onResolve: (row: SendReconciliationRow, mode: 'confirmed_sent' | 'confirmed_not_sent') => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

const TONE: Record<TimelineEntry['tone'], string> = {
  neutral: 'bg-slate-400',
  info: 'bg-blue-600',
  success: 'bg-emerald-600',
  warning: 'bg-amber-500',
  danger: 'bg-red-600',
};

function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="space-y-2">
      {entries.map((entry, index) => (
        <li key={`${entry.label}-${index}`} className="flex gap-3 text-sm">
          <span aria-hidden className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', TONE[entry.tone])} />
          <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{entry.at ? formatMoment(entry.at) : '—'}</span>
          <span>{entry.label}</span>
        </li>
      ))}
    </ol>
  );
}

/** Línea de tiempo con los intentos que devuelve la RPC saneada de detalle. */
function attemptEntries(attempts: DeliveryAttemptRow[]): TimelineEntry[] {
  const total = Math.max(2, ...attempts.map((attempt) => attempt.attempt_no));
  return attempts.flatMap((attempt) => {
    const entries: TimelineEntry[] = [{
      at: attempt.started_at,
      label: `Intento ${attempt.attempt_no}/${total} iniciado → ${attemptStateLabel(attempt.state)}${attempt.provider_message_ref ? ` (${attempt.provider_message_ref})` : ''}`,
      tone: attempt.error_code ? 'danger' : 'info',
    }];
    if (attempt.last_status && attempt.status_occurred_at) {
      entries.push({ at: attempt.status_occurred_at, label: `Intento ${attempt.attempt_no}: ${attempt.last_status} (comunicado por Meta)`, tone: 'success' });
    }
    if (attempt.error_code || attempt.error_detail) {
      entries.push({ at: attempt.finalized_at, label: `Intento ${attempt.attempt_no}: ${attempt.error_detail || attempt.error_code}`, tone: 'danger' });
    }
    return entries;
  });
}

const ACTION_STATUS: Record<string, string> = {
  pending: 'pendiente', processing: 'en proceso', effect_pending: 'aplicándose', completed: 'completada', failed: 'fallida',
};

export function WhatsAppDeliveryDetail({ deliveryId, row, queueRow, isAdmin, onClose, onResolve }: Props) {
  const detail = useQuery({
    queryKey: ['whatsapp-delivery-detail', deliveryId],
    enabled: Boolean(deliveryId),
    retry: false,
    staleTime: 30_000,
    queryFn: async (): Promise<DetailPayload> => {
      const { data, error } = await rpcUntyped('get_whatsapp_delivery_detail', { _delivery_id: deliveryId });
      if (error) throw error;
      const source = (data ?? {}) as Partial<DetailPayload>;
      return {
        attempts: Array.isArray(source.attempts) ? source.attempts : [],
        actions: Array.isArray(source.actions) ? source.actions : null,
        recipient_name_snapshot: source.recipient_name_snapshot ?? null,
        snapshot_property: source.snapshot_property ?? null,
        snapshot_task_date: source.snapshot_task_date ?? null,
      };
    },
  });

  const open = Boolean(deliveryId);
  const info = row ? statusInfo(row) : null;
  const cause = row ? skipCause(row) : null;
  const failure = row ? failureLabel(row) : null;
  const name = row?.cleaner_name || detail.data?.recipient_name_snapshot || null;
  const property = row?.property || detail.data?.snapshot_property || null;
  const taskDate = formatTaskDate(row?.task_date || detail.data?.snapshot_task_date || null);
  const attempts = detail.data?.attempts ?? [];
  const uncertainty = queueRow ? uncertaintyLabel(queueRow.uncertainty_state) : null;

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle>{row ? eventLabel(row) : queueRow ? 'Envío pendiente de comprobación' : 'Aviso de WhatsApp'}</SheetTitle>
          <SheetDescription>
            {[name ?? 'Destinatario sin identificar', row?.recipient_masked ?? queueRow?.recipient_masked].filter(Boolean).join(' · ')}
            {(property || taskDate) && <><br />{[property, taskDate].filter(Boolean).join(' · ')}</>}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-6">
          {row && info && (
            <Section title="Estado actual">
              <div className="flex flex-wrap items-center gap-2"><WhatsAppStatusBadge row={row} /></div>
              <p className="text-sm">{info.meaning}</p>
              {cause && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><strong>{cause.label}.</strong> {cause.hint}</p>}
              {!cause && failure && info.key !== 'uncertain' && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900"><strong>{failure}.</strong> {row.error_detail}</p>}
            </Section>
          )}

          {!row && (
            <p className="rounded-lg border p-3 text-sm text-muted-foreground">
              Este envío no está en la página actual del historial (otro periodo, filtro o página). Se muestran los datos de la cola de comprobación.
            </p>
          )}

          {row && (
            <Section title="Línea de tiempo">
              <Timeline entries={basicTimeline(row)} />
              {detail.isLoading && <p className="text-sm text-muted-foreground">Cargando intentos…</p>}
              {attempts.length > 0 && <Timeline entries={attemptEntries(attempts)} />}
              {detail.isError && isMissingRpc(detail.error) && (
                <p className="text-xs text-muted-foreground">El servidor todavía no ofrece el historial de intentos (1/2, 2/2) ni las acciones manuales; se muestran las horas registradas en el aviso.</p>
              )}
              {detail.isError && !isMissingRpc(detail.error) && (
                <p role="alert" className="text-xs text-red-700">No se pudo cargar el historial de intentos. <button type="button" className="underline" onClick={() => void detail.refetch()}>Reintentar</button></p>
              )}
              {attempts.length > 1 && attempts.some((attempt) => attempt.state === 'completed_uncertain' || attempt.state === 'uncertain') && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Posible duplicado: si el intento incierto llegó, la persona pudo recibir dos mensajes.</p>
              )}
            </Section>
          )}

          {row && (
            <Section title="Datos técnicos">
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Plantilla</dt><dd className="break-words">{row.template_name ?? '—'}</dd>
                <dt className="text-muted-foreground">ID de Meta</dt><dd>{row.provider_message_ref ?? 'Sin ID'}</dd>
                <dt className="text-muted-foreground">Código</dt><dd>{row.error_code ?? '—'}</dd>
                {row.error_detail && <><dt className="text-muted-foreground">Mensaje</dt><dd className="break-words">{row.error_detail}</dd></>}
              </dl>
            </Section>
          )}

          {queueRow && uncertainty && (
            <Section title="Comprobación manual">
              <p className="text-sm"><strong>{uncertainty.label}.</strong> {uncertainty.explanation}</p>
              {queueRow.open_action_status && <p className="text-sm text-amber-800">Resolución encolada para el servidor ({ACTION_STATUS[queueRow.open_action_status] ?? queueRow.open_action_status}).</p>}
              {isAdmin && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={!uncertainty.canConfirm || Boolean(queueRow.open_action_status)} onClick={() => onResolve(queueRow, 'confirmed_sent')}>Confirmar enviado…</Button>
                  {queueRow.channel === 'email' && (
                    <Button size="sm" variant="destructive" disabled={Boolean(queueRow.open_action_status)} onClick={() => onResolve(queueRow, 'confirmed_not_sent')}>Confirmar no enviado…</Button>
                  )}
                </div>
              )}
            </Section>
          )}

          {detail.data?.actions && detail.data.actions.length > 0 && (
            <Section title="Acciones manuales">
              <ul className="space-y-1 text-sm">
                {detail.data.actions.map((action, index) => (
                  <li key={`${action.requested_at}-${index}`}>
                    {formatMoment(action.requested_at)} · {action.resolution === 'confirmed_sent' ? 'Confirmado como enviado' : 'Confirmado como no enviado'}
                    {action.requested_by_name ? ` por ${action.requested_by_name}` : ''} · {ACTION_STATUS[action.status] ?? action.status}
                    {action.result_detail ? ` · ${action.result_detail}` : ''}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
