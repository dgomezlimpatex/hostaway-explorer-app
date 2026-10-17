import { useCallback, useMemo, useRef, useState } from 'react';
import type { Cleaner, Task } from '@/types/calendar';
import type { AssignmentProposal, EffectiveWorkerAvailability } from '@/types/cleaningPlanning';
import type { CleanerGroupAssignment } from '@/types/propertyGroups';
import type { DraftView, PlanningDraftManager } from '@/utils/cleaning-planning/planningDraftManager';
import {
  evaluateDraftRecovery,
  taskStatesAgree,
  type DraftEvaluation,
} from '@/utils/cleaning-planning/planningDraftRecovery';
import { draftStorageKey, type DraftIdentity, type DraftRemoveResult } from '@/utils/cleaning-planning/planningDraftStore';

export interface RecoveredDraft {
  proposals: AssignmentProposal[];
  editedTaskIds: string[];
}

export interface PlanningDraftRecoveryInputs {
  /** Todas las tareas del periodo que muestra la pantalla, sin filtros. */
  allTasks: Task[];
  /** Tareas visibles con los filtros actuales. */
  scopeTasks: Task[];
  cleaners: Cleaner[];
  availability: EffectiveWorkerAvailability[];
  excludedCleanerAssignments: CleanerGroupAssignment[];
}

interface Options extends PlanningDraftRecoveryInputs {
  manager: PlanningDraftManager;
  identity: DraftIdentity | null;
  view: DraftView;
  /** Los datos necesarios para comprobar el borrador ya están cargados. */
  ready: boolean;
  /** Vuelve a leer las tareas de la base de datos (solo lectura). `null` si no se pudo. */
  refreshTasks: () => Promise<Task[] | null>;
  onRecovered: (draft: RecoveredDraft, evaluation: DraftEvaluation) => void;
}

const waitUntil = async (condition: () => boolean, timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return true;
    await new Promise<void>((resolve) => setTimeout(resolve, 40));
  }
  return condition();
};

/**
 * Recuperación explícita de un borrador: comprueba el estado actual y, solo entonces, entrega a la
 * pantalla las propuestas que se pueden recuperar. No guarda nada en las tareas reales.
 */
export const usePlanningDraftRecovery = (options: Options) => {
  const { manager, identity, view, ready } = options;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const latest = useRef(options);
  latest.current = options;

  const record = view.decision === 'foreign' ? view.stored : null;
  const { allTasks, cleaners, availability, excludedCleanerAssignments, scopeTasks } = options;
  const evaluation = useMemo<DraftEvaluation | null>(() => (
    record && ready
      ? evaluateDraftRecovery({ record, freshTasks: allTasks, scopeTasks, cleaners, availability, excludedCleanerAssignments })
      : null
  ), [record, ready, allTasks, scopeTasks, cleaners, availability, excludedCleanerAssignments]);

  const recover = useCallback(async () => {
    const start = latest.current;
    if (busyRef.current || !start.identity || !start.ready) return;
    const identityKey = draftStorageKey(start.identity);
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      start.manager.refresh(start.identity);
      const current = start.manager.getView(start.identity);
      const stored = current.decision === 'foreign' ? current.stored : null;
      if (!stored) {
        setError('El borrador ya no está disponible. Puede que se haya guardado o descartado en otra pestaña.');
        return;
      }
      const fresh = await start.refreshTasks();
      if (!fresh) {
        setError('No se pudo comprobar el estado actual de las limpiezas. El borrador se conserva; inténtalo de nuevo cuando haya conexión.');
        return;
      }
      const taskIds = Array.from(new Set(stored.proposals.map((proposal) => proposal.taskId)));
      const synced = await waitUntil(() => taskStatesAgree(fresh, latest.current.allTasks, taskIds), 3000);
      const after = latest.current;
      if (!after.identity || draftStorageKey(after.identity) !== identityKey) return;
      if (!synced) {
        setError('Los datos todavía se están actualizando. El borrador se conserva; inténtalo de nuevo en unos segundos.');
        return;
      }
      const checked = evaluateDraftRecovery({
        record: stored,
        freshTasks: fresh,
        scopeTasks: after.scopeTasks,
        cleaners: after.cleaners,
        availability: after.availability,
        excludedCleanerAssignments: after.excludedCleanerAssignments,
      });
      const shown = new Set(evaluation?.conflicts.map((conflict) => conflict.taskId));
      if (checked.conflicts.some((conflict) => !shown.has(conflict.taskId))) {
        setError('Han cambiado datos mientras se comprobaba el borrador. Revisa el aviso y vuelve a pulsar «Recuperar borrador».');
        return;
      }
      if (checked.status === 'blocked') {
        setError('No se puede recuperar ninguna tarea de este borrador. Se conserva hasta que decidas descartarlo.');
        return;
      }
      after.manager.acceptRecord(after.identity, stored);
      after.onRecovered({ proposals: checked.recoverable, editedTaskIds: checked.editedTaskIds }, checked);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [evaluation]);

  const discard = useCallback((): DraftRemoveResult | null => {
    const current = latest.current;
    if (!current.identity) return null;
    setError(null);
    const result = current.manager.discard(current.identity);
    if (result.status === 'failed') setError('No se pudo eliminar el borrador de este navegador. Inténtalo de nuevo.');
    return result;
  }, []);

  return { evaluation, busy, error, recover, discard };
};
