import { AlertTriangle, CheckCircle2, CloudOff, CloudUpload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type CleanerSendState = 'sent' | 'sending' | 'offline' | 'pending' | 'error';

interface DraftProgress { revision: number; syncedRevision: number; error?: string }
interface NetworkProgress { isOnline: boolean; isSyncing: boolean }

/** Whether the finished cleaning has reached coordination, from the saved draft and the queue. */
// Shared mapping is also exercised without a browser.
// eslint-disable-next-line react-refresh/only-export-components
export function getCleanerSendState(draft: DraftProgress | null, status: NetworkProgress | null): CleanerSendState {
  if (!draft || draft.revision <= draft.syncedRevision) return 'sent';
  if (status && !status.isOnline) return 'offline';
  if (status?.isSyncing) return 'sending';
  if (draft.error) return 'error';
  return 'pending';
}

const views = {
  sent: { Icon: CheckCircle2, tone: 'border-green-200 bg-green-50 text-green-800', title: 'Limpieza enviada',
    text: 'Coordinación ya tiene el reporte y las fotos.' },
  sending: { Icon: Loader2, tone: 'border-blue-200 bg-blue-50 text-blue-800', title: 'Enviando la limpieza…',
    text: 'Mantén la app abierta con cobertura hasta que aparezca «Limpieza enviada».' },
  offline: { Icon: CloudOff, tone: 'border-amber-300 bg-amber-50 text-amber-900', title: 'Guardada en el móvil, sin enviar',
    text: 'No hay cobertura. Se enviará cuando vuelva la conexión con la app abierta. No borres los datos de la app.' },
  pending: { Icon: CloudUpload, tone: 'border-amber-300 bg-amber-50 text-amber-900', title: 'Pendiente de enviar',
    text: 'Mantén la app abierta con cobertura. Se enviará en unos segundos.' },
  error: { Icon: AlertTriangle, tone: 'border-red-200 bg-red-50 text-red-800', title: 'No se ha podido enviar',
    text: 'Tu trabajo sigue guardado en el móvil.' },
} as const;

export function CleanerSendStatus({ state, error, onRetry, retrying }: {
  state: CleanerSendState; error?: string; onRetry?: () => void; retrying?: boolean;
}) {
  const view = views[state];
  return <div role="status" aria-live="polite" data-send-state={state} className={`mb-3 rounded-xl border p-3 text-sm ${view.tone}`}>
    <p className="flex items-center gap-2 font-semibold">
      <view.Icon className={`h-4 w-4 shrink-0 ${state === 'sending' ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
      {view.title}
    </p>
    {state === 'error' && error && <p className="mt-1">{error}</p>}
    <p className="mt-1">{view.text}</p>
    {(state === 'error' || state === 'pending') && onRetry && <Button type="button" variant="outline" className="mt-2 min-h-11 w-full bg-background" disabled={retrying} onClick={onRetry}>
      Reintentar envío
    </Button>}
  </div>;
}
