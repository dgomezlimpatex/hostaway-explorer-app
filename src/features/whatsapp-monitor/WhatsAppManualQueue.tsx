import { useId, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  MANUAL_QUEUE_LIMIT,
  RECENT_QUEUE_DAYS,
  dateRangeLabel,
  isForbidden,
  maskedPhone,
  momentWithAge,
  queueAttempt,
  queueIdentity,
  queueState,
  splitQueueByAge,
  type DeliveryRow,
  type QueueStateKey,
  type SendReconciliationRow,
} from './whatsappMonitorModel';

interface Props {
  rows: SendReconciliationRow[];
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  /** Filas del historial cargado, solo para poner nombre si coinciden. */
  historyById: Map<string, DeliveryRow>;
  selectedId: string | null;
  onReview: (deliveryId: string) => void;
}

const STATE_STYLE: Record<QueueStateKey, string> = {
  unconfirmed: 'bg-amber-50 text-amber-900 ring-amber-200',
  contacting: 'bg-slate-100 text-slate-700 ring-slate-200',
  registering: 'bg-blue-50 text-blue-800 ring-blue-200',
  unknown: 'bg-slate-100 text-slate-800 ring-slate-300',
};

function QueueItem({ row, history, selected, onReview }: { row: SendReconciliationRow; history?: DeliveryRow; selected: boolean; onReview: () => void }) {
  const id = queueIdentity(row, history);
  const state = queueState(row);
  const attempt = queueAttempt(row);
  return (
    <li className={cn('flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4', selected && 'bg-muted/50')}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {id.title}
          {id.phone && <span className="ml-2 font-normal text-muted-foreground">{id.phone}</span>}
          {row.channel === 'email' && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">Email alternativo</span>}
        </p>
        <p className="truncate text-sm">
          {id.subject ?? <span className="text-muted-foreground">Asunto no disponible</span>}
          {id.task && <span className="text-muted-foreground"> · {id.task}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{momentWithAge(row.created_at)}</p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="flex flex-col items-start gap-1 sm:items-end">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', STATE_STYLE[state.key])}>{state.label}</span>
          {attempt.retryPending && !row.open_action_status && <span className="text-xs text-muted-foreground">Reintento automático posible</span>}
        </span>
        <Button size="sm" onClick={onReview} aria-label={`Revisar ${id.subject ?? 'envío'} · ${id.title} · ${momentWithAge(row.created_at)}`}>
          Revisar<ChevronRight aria-hidden className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}

function Group({ title, rows, defaultOpen, historyById, selectedId, onReview }: {
  title: string; rows: SendReconciliationRow[]; defaultOpen: boolean;
  historyById: Map<string, DeliveryRow>; selectedId: string | null; onReview: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const listId = useId();
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span>
          <span className="font-semibold">{title} ({rows.length})</span>
          <span className="block text-xs text-muted-foreground sm:ml-2 sm:inline">{dateRangeLabel(rows)}</span>
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">{open ? 'Ocultar' : 'Mostrar'}<ChevronDown aria-hidden className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} /></span>
      </button>
      <ul id={listId} aria-label={`${title}: envíos por comprobar`} className={cn('divide-y border-t', !open && 'hidden')}>
        {rows.map((row) => (
          <QueueItem key={row.delivery_id} row={row} history={historyById.get(row.delivery_id)} selected={selectedId === row.delivery_id} onReview={() => onReview(row.delivery_id)} />
        ))}
      </ul>
    </div>
  );
}

/** Lista compacta de envíos cuyo resultado hay que comprobar a mano (solo administración). */
export function WhatsAppManualQueue({ rows, isError, error, onRetry, historyById, selectedId, onReview }: Props) {
  const { recent, older } = splitQueueByAge(rows);
  const anyRetryPending = rows.some((row) => queueAttempt(row).retryPending);
  const providers = new Set(rows.map((row) => row.channel));
  const provider = providers.size > 1 ? 'Meta o Resend' : providers.has('email') ? 'Resend' : 'Meta';
  return (
    <section aria-labelledby="wa-manual" className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="space-y-1">
        <h2 id="wa-manual" className="text-base font-semibold">Envíos por comprobar{rows.length > 0 && ` (${rows.length})`}</h2>
        {rows.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {provider} no confirmó si estos mensajes salieron y no se reenvían solos. Pulsa «Revisar» para ver qué hacer con cada uno.
            {anyRetryPending && ' Los marcados «Reintento automático posible» aún pueden tener un último intento del servidor.'}
          </p>
        )}
      </div>
      {isError && !isForbidden(error) && (
        <p role="alert" className="text-sm text-red-700">No se pudo comprobar la cola. <button type="button" className="underline" onClick={onRetry}>Reintentar</button></p>
      )}
      {isError && isForbidden(error) && <p className="text-sm text-muted-foreground">Esta cola es solo de administración.</p>}
      {rows.length > 0 && (
        <div className="space-y-2">
          <Group title={`Últimos ${RECENT_QUEUE_DAYS} días`} rows={recent} defaultOpen historyById={historyById} selectedId={selectedId} onReview={onReview} />
          <Group title="Anteriores" rows={older} defaultOpen={recent.length === 0} historyById={historyById} selectedId={selectedId} onReview={onReview} />
        </div>
      )}
      {rows.length >= MANUAL_QUEUE_LIMIT && (
        <p className="text-xs text-amber-800">Se muestran los {MANUAL_QUEUE_LIMIT} más antiguos que devuelve el servidor; puede haber más pendientes.</p>
      )}
    </section>
  );
}
