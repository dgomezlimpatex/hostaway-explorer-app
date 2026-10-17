import { useState } from 'react';
import { AlertTriangle, HardDrive, History, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DraftView } from '@/utils/cleaning-planning/planningDraftManager';
import type { DraftEvaluation } from '@/utils/cleaning-planning/planningDraftRecovery';
import { describeDraftPeriod, describeDraftTime, describeStoredDraft, describeTaskCount } from '@/utils/cleaning-planning/planningDraftText';
import type { DraftSummary } from '@/utils/cleaning-planning/planningDraftStore';

interface PlanningDraftNoticeProps {
  /** `start`: pantalla inicial. `panel`: ya hay cambios en pantalla que un borrador anterior podría sustituir. */
  variant: 'start' | 'panel';
  view: DraftView;
  evaluation: DraftEvaluation | null;
  busy: boolean;
  error: string | null;
  onRecover: () => void;
  onDiscard: () => void;
}

/** Aviso de un reparto sin guardar encontrado en este navegador. Recuperar y descartar son siempre decisiones explícitas. */
export const PlanningDraftNotice = ({ variant, view, evaluation, busy, error, onRecover, onDiscard }: PlanningDraftNoticeProps) => {
  const [confirm, setConfirm] = useState<'discard' | 'replace' | null>(null);
  const record = view.decision === 'foreign' ? view.stored : null;
  if (!record) return null;
  const summary: DraftSummary = {
    identity: { userId: record.userId, sedeId: record.sedeId, startDate: record.startDate, endDate: record.endDate },
    revision: record.revision, updatedAt: record.updatedAt, taskCount: record.taskCount,
  };
  const checking = evaluation === null;
  const blocked = evaluation?.status === 'blocked';
  const partial = evaluation?.status === 'partial';
  const canRecover = !checking && !blocked && !busy;
  const handleRecoverClick = () => {
    if (variant === 'panel' && confirm !== 'replace') { setConfirm('replace'); return; }
    setConfirm(null);
    onRecover();
  };

  return (
    <section
      data-planning-draft-notice
      aria-label="Borrador sin guardar"
      className="rounded-lg border border-brand/30 bg-line-soft p-4 text-sm text-ink"
    >
      <div className="flex items-start gap-3">
        <History aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold">{describeStoredDraft(summary)}</p>
          <p className="text-ink-3">
            Está guardado solo en este navegador. No se ha aplicado a las limpiezas reales ni se ha avisado a nadie hasta que pulses «Guardar cambios».
            {variant === 'panel' && ' Mientras no elijas, los cambios de esta pantalla no se conservan. Recuperar el borrador sustituye lo que ves ahora.'}
          </p>

          {checking && <p role="status" className="text-ink-3">Comprobando el borrador con los datos actuales…</p>}

          {evaluation && evaluation.conflicts.length > 0 && (
            <div role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
                {blocked
                  ? 'No se puede recuperar ninguna tarea de este borrador.'
                  : `Se pueden recuperar ${evaluation.recoveredTaskCount} de ${evaluation.totalTaskCount} tareas.`}
              </p>
              <p className="mt-1">
                {blocked
                  ? 'Han cambiado desde que lo guardaste. El borrador se conserva hasta que decidas descartarlo.'
                  : `${describeTaskCount(evaluation.conflicts.length)} ${evaluation.conflicts.length === 1 ? 'ha cambiado y no se recuperará' : 'han cambiado y no se recuperarán'}; el resto queda como lo dejaste.`}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {evaluation.conflicts.map((conflict) => (
                  <li key={conflict.taskId}><span className="font-medium">{conflict.label}</span>: {conflict.reasons.join('; ')}.</li>
                ))}
              </ul>
            </div>
          )}

          {error && <p role="alert" className="font-medium text-red-800">{error}</p>}

          {confirm === 'discard' ? (
            <div role="group" aria-label="Confirmar descarte" className="flex flex-wrap items-center gap-2">
              <p className="w-full font-medium">¿Descartar este borrador? Se eliminará de este navegador y no se podrá recuperar.</p>
              <Button type="button" variant="outline" className="min-h-[44px] border-red-300 text-red-800 hover:bg-red-50" onClick={() => { setConfirm(null); onDiscard(); }}>
                Sí, descartar
              </Button>
              <Button type="button" variant="outline" className="min-h-[44px] border-line text-brand" onClick={() => setConfirm(null)}>
                No, conservar
              </Button>
            </div>
          ) : confirm === 'replace' ? (
            <div role="group" aria-label="Confirmar recuperación" className="flex flex-wrap items-center gap-2">
              <p className="w-full font-medium">Se sustituirán los cambios que ves ahora por los del borrador. ¿Continuar?</p>
              <Button type="button" className="min-h-[44px] bg-brand text-white hover:bg-ink" disabled={!canRecover} onClick={handleRecoverClick}>
                Sí, recuperar
              </Button>
              <Button type="button" variant="outline" className="min-h-[44px] border-line text-brand" onClick={() => setConfirm(null)}>
                No, seguir con lo actual
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-[44px] bg-brand text-white hover:bg-ink" disabled={!canRecover} onClick={handleRecoverClick}>
                {busy ? 'Comprobando…' : partial ? `Recuperar borrador (${evaluation.recoveredTaskCount} de ${evaluation.totalTaskCount})` : 'Recuperar borrador'}
              </Button>
              <Button type="button" variant="outline" className="min-h-[44px] border-line text-brand" disabled={busy} onClick={() => setConfirm('discard')}>
                Descartar borrador
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

interface PlanningDraftOthersProps {
  others: DraftSummary[];
  onOpen: (summary: DraftSummary) => void;
  canOpen: (summary: DraftSummary) => boolean;
}

/** Borradores de otros días: el cambio de fecha o sede nunca los pierde ni los mezcla. */
export const PlanningDraftOthers = ({ others, onOpen, canOpen }: PlanningDraftOthersProps) => {
  if (others.length === 0) return null;
  const now = new Date();
  return (
    <section aria-label="Borradores de otros días" className="rounded-lg border border-line bg-paper p-4 text-sm text-ink-3">
      <p className="flex items-center gap-2 font-semibold text-ink"><Info aria-hidden="true" className="h-4 w-4 text-brand" /> También tienes repartos sin guardar de otros días</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {others.map((draft) => {
          const label = `${describeDraftPeriod(draft.identity.startDate, draft.identity.endDate, now)} · ${describeTaskCount(draft.taskCount)} · ${describeDraftTime(draft.updatedAt, now)}`;
          return (
            <li key={`${draft.identity.startDate}:${draft.identity.endDate}`}>
              {canOpen(draft)
                ? <Button type="button" variant="outline" className="min-h-[44px] border-line text-brand" onClick={() => onOpen(draft)}>Ir a {label}</Button>
                : <span className="inline-block rounded-md border border-line bg-white px-3 py-2">{label}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const failureText: Record<NonNullable<DraftView['failure']>, string> = {
  unavailable: 'el navegador no permite guardar datos locales',
  quota: 'no queda espacio de almacenamiento en el navegador',
  'too-large': 'el borrador es demasiado grande',
  unsupported: 'hay un borrador de otra versión de la app; recarga la página',
};

interface PlanningDraftStatusProps {
  view: DraftView;
  /** Falta identificar la sesión o la sede, así que no hay dónde conservar el borrador. */
  identityMissing: boolean;
  onResume: () => void;
  onRetry: () => void;
}

/** Estado del borrador local. «Conservado» solo se muestra tras confirmar la escritura. */
export const PlanningDraftStatus = ({ view, identityMissing, onResume, onRetry }: PlanningDraftStatusProps) => {
  const now = new Date();
  if (identityMissing || view.saveState === 'failed' || !view.storageAvailable) {
    const reason = identityMissing ? 'no se ha podido identificar tu sesión o la sede' : view.failure ? failureText[view.failure] : failureText.unavailable;
    return (
      <div role="alert" data-planning-draft-status="failed" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-900">
        <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>No se ha podido conservar el borrador en este navegador: {reason}. Guarda el reparto antes de salir o se perderán los cambios.</span>
        {!identityMissing && view.failure !== 'unsupported' && (
          <button type="button" className="underline underline-offset-2" onClick={onRetry}>Reintentar</button>
        )}
      </div>
    );
  }
  if (view.removedElsewhere) {
    return (
      <div role="alert" data-planning-draft-status="removed" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-900">
        <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>El borrador se eliminó desde otra pestaña, así que los cambios de esta pantalla ya no se conservan.</span>
        <button type="button" className="underline underline-offset-2" onClick={onResume}>Volver a conservarlo</button>
      </div>
    );
  }
  if (view.decision === 'foreign') {
    return <p data-planning-draft-status="paused" className="text-xs font-semibold text-amber-900">Esperando tu elección sobre el borrador guardado; mientras tanto no se conservan los cambios de esta pantalla.</p>;
  }
  if (view.saveState === 'pending') {
    return <p data-planning-draft-status="pending" className="text-xs font-semibold text-ink-3">Conservando el borrador en este navegador…</p>;
  }
  if (view.saveState === 'saved' && view.savedAt) {
    return (
      <p data-planning-draft-status="saved" className="flex items-center gap-1.5 text-xs font-semibold text-brand">
        <HardDrive aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        Borrador conservado en este navegador, modificado {describeDraftTime(view.savedAt, now)}. Aún no está aplicado a las limpiezas reales.
      </p>
    );
  }
  return null;
};

interface PlanningDraftReportProps {
  recovered: number;
  total: number;
  conflicts: DraftEvaluation['conflicts'];
  onClose: () => void;
}

/** Qué se recuperó y qué no tras una recuperación parcial. */
export const PlanningDraftReport = ({ recovered, total, conflicts, onClose }: PlanningDraftReportProps) => (
  <section role="status" data-planning-draft-report className="rounded-lg border border-brand/30 bg-line-soft p-4 text-sm text-ink">
    <p className="font-semibold">
      {conflicts.length === 0
        ? `Borrador recuperado: ${describeTaskCount(total)}. Revisa el reparto; los cambios siguen pendientes hasta pulsar «Guardar cambios».`
        : `Borrador recuperado en parte: ${recovered} de ${total} tareas. Los cambios siguen pendientes hasta pulsar «Guardar cambios».`}
    </p>
    {conflicts.length > 0 && (
      <>
        <p className="mt-1 text-ink-3">No se recuperaron porque han cambiado:</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {conflicts.map((conflict) => <li key={conflict.taskId}><span className="font-medium">{conflict.label}</span>: {conflict.reasons.join('; ')}.</li>)}
        </ul>
      </>
    )}
    <Button type="button" variant="outline" className="mt-3 min-h-[44px] border-line text-brand" onClick={onClose}>Entendido</Button>
  </section>
);
