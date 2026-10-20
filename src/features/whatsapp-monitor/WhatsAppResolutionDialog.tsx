import { useEffect, useId, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ageLabel,
  formatMoment,
  queueAttempt,
  recipientLabel,
  templateSubject,
  resendWindow,
  resolutionErrorMessage,
  uncertaintyLabel,
  validateProviderMessageId,
  type SendReconciliationRow,
} from './whatsappMonitorModel';

export type ResolutionMode = 'confirmed_sent' | 'confirmed_not_sent';

interface Props {
  row: SendReconciliationRow | null;
  mode: ResolutionMode;
  /** Nombre resuelto por vínculo exacto; null si no se conoce. */
  recipientName: string | null;
  onClose: () => void;
  onSubmit: (row: SendReconciliationRow, mode: ResolutionMode, providerMessageId: string | null) => Promise<void>;
}

/** Diálogo propio para cerrar un envío incierto. El servidor vuelve a validar todo. */
export function WhatsAppResolutionDialog({ row, mode, recipientName, onClose, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  useEffect(() => {
    setValue('');
    setTouched(false);
    setServerError(null);
    setSubmitting(false);
  }, [row?.delivery_id, mode]);

  if (!row) return null;
  const isWhatsApp = row.channel === 'whatsapp';
  const provider = isWhatsApp ? 'Meta' : 'Resend';
  const uncertainty = uncertaintyLabel(row.uncertainty_state);
  const attempt = queueAttempt(row);
  const safeWindow = resendWindow(row.created_at);
  const validation = mode === 'confirmed_sent' ? validateProviderMessageId(row.channel, value) : null;
  // Un WhatsApp incierto nunca se reabre: doble barrera además del servidor.
  const notSentBlocked = mode === 'confirmed_not_sent' && (isWhatsApp || safeWindow.expired);
  const blocked = !uncertainty.canConfirm || notSentBlocked || Boolean(row.open_action_status);

  const submit = async () => {
    setTouched(true);
    if (blocked || validation) return;
    setSubmitting(true);
    setServerError(null);
    try {
      await onSubmit(row, mode, mode === 'confirmed_sent' ? value.trim() : null);
      onClose();
    } catch (error) {
      setServerError(resolutionErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'confirmed_sent' ? `Registrar como enviado en ${provider}` : 'Registrar como no enviado y reintentar'}</DialogTitle>
          <DialogDescription>
            {isWhatsApp ? 'WhatsApp' : 'Email alternativo'} · {recipientName && `${recipientName} · `}{recipientLabel(row.recipient_masked, row.channel)} · {templateSubject(row.template_name) ?? 'asunto no disponible'}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
          <dt className="text-muted-foreground">Estado</dt><dd className="font-medium">{uncertainty.label}</dd>
          <dt className="text-muted-foreground">Creado</dt><dd>{formatMoment(row.created_at)} ({ageLabel(row.created_at)})</dd>
          {isWhatsApp && <><dt className="text-muted-foreground">Intento</dt><dd>{attempt.exhausted ? '2/2 incierto. No habrá más intentos automáticos.' : attempt.retryPending ? '1/2 incierto. Como máximo habrá un reintento automático 2/2.' : attempt.attempt ? `${attempt.attempt} incierto.` : 'No indicado por el servidor.'}</dd></>}
          {!isWhatsApp && <><dt className="text-muted-foreground">Ventana segura</dt><dd>{safeWindow.expired ? 'Probablemente vencida' : `Quedan unas ${safeWindow.remainingHours} h`} <span className="text-muted-foreground">(estimada desde la creación)</span></dd></>}
        </dl>

        {!uncertainty.canConfirm && <p role="status" className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />{uncertainty.explanation}</p>}
        {row.open_action_status && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Ya hay una resolución en curso para este envío.</p>}

        {mode === 'confirmed_sent' ? (
          <div className="space-y-2">
            <Label htmlFor={inputId}>ID del mensaje en {provider}</Label>
            <Input
              id={inputId}
              value={value}
              autoComplete="off"
              spellCheck={false}
              placeholder={isWhatsApp ? 'wamid.…' : 'ID del email en Resend'}
              disabled={blocked || submitting}
              aria-invalid={touched && Boolean(validation)}
              aria-describedby={errorId}
              onChange={(event) => setValue(event.target.value)}
              onBlur={() => setTouched(true)}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void submit(); } }}
            />
            <p id={errorId} className="text-xs text-muted-foreground">
              {touched && validation
                ? <span className="font-medium text-red-700">{validation}</span>
                : `No envía otro ${isWhatsApp ? 'WhatsApp' : 'email'} ni demuestra que la persona lo recibió. Comprueba en ${provider} que ese mensaje fue a esta persona y a este aviso: el formato correcto no demuestra que el destinatario sea el correcto.`}
            </p>
          </div>
        ) : (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
            {isWhatsApp
              ? 'Un WhatsApp incierto no admite reintentos manuales: el servidor limita el flujo a un máximo de 2 intentos y Meta no permite demostrar que un envío no salió.'
              : safeWindow.expired
                ? 'La ventana segura de 23 h probablemente ha vencido y el servidor rechazará el reintento. Comprueba en Resend y, si salió, confirma como enviado.'
                : 'Confirma solo si has comprobado en Resend que este email NO se envió. El servidor autorizará un único reintento.'}
          </p>
        )}

        {serverError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">{serverError}</p>}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button
            variant={mode === 'confirmed_sent' ? 'default' : 'destructive'}
            onClick={() => void submit()}
            disabled={blocked || submitting || (mode === 'confirmed_sent' && touched && Boolean(validation))}
          >
            {submitting ? 'Registrando…' : mode === 'confirmed_sent' ? 'Registrar como enviado' : 'Registrar y reintentar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
