import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, Sparkles, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Cleaner } from '@/types/calendar';
import { AssignmentProposal, AssignmentProposalResult, CleaningPlanningTask } from '@/types/cleaningPlanning';
import { CleanerGroupAssignment } from '@/types/propertyGroups';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { buildProposalSignature } from '@/utils/cleaning-planning/proposalBatchApply';
import { PlanningProposalCalendar, PlanningProposalDraftWarning } from './PlanningProposalCalendar';

interface AssignmentProposalPanelProps {
  proposal: AssignmentProposalResult | null;
  tasks: CleaningPlanningTask[];
  calendarTasks?: CleaningPlanningTask[];
  cleaners?: Cleaner[];
  activeCleanerAssignments?: CleanerGroupAssignment[];
  excludedCleanerAssignments?: CleanerGroupAssignment[];
  isApplying?: boolean;
  isStale?: boolean;
  sedeName?: string;
  isPartialScope?: boolean;
  totalPendingTaskCount?: number;
  onApply: (draftProposals: AssignmentProposal[]) => Promise<void>;
  onClear: () => void;
}

interface StoredProposalDraft {
  sourceSignature: string;
  proposals: AssignmentProposal[];
}

const storageKeyForSignature = (signature: string): string => (
  `cleaning-planning:hermes-draft:${encodeURIComponent(signature)}`
);

const readStoredDraft = (key: string, sourceSignature: string): AssignmentProposal[] | null => {
  try {
    const stored = sessionStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as StoredProposalDraft;
    if (parsed.sourceSignature !== sourceSignature || !Array.isArray(parsed.proposals)) return null;
    return parsed.proposals;
  } catch {
    return null;
  }
};

export const AssignmentProposalPanel = ({
  proposal,
  tasks,
  calendarTasks = tasks,
  cleaners = [],
  activeCleanerAssignments = [],
  excludedCleanerAssignments = [],
  isApplying = false,
  isStale = false,
  sedeName,
  isPartialScope = false,
  totalPendingTaskCount = 0,
  onApply,
  onClear,
}: AssignmentProposalPanelProps) => {
  const [draftProposals, setDraftProposals] = useState<AssignmentProposal[]>([]);
  const [draftWarnings, setDraftWarnings] = useState<PlanningProposalDraftWarning[]>([]);
  const [draftSourceSignature, setDraftSourceSignature] = useState('');
  const [applyError, setApplyError] = useState('');
  const [draftSafetyReady, setDraftSafetyReady] = useState(false);
  const applyInFlightRef = useRef(false);

  const sourceSignature = useMemo(
    () => (proposal ? buildProposalSignature(proposal.proposals) : ''),
    [proposal],
  );
  const storageKey = useMemo(
    () => (sourceSignature ? storageKeyForSignature(sourceSignature) : ''),
    [sourceSignature],
  );

  useEffect(() => {
    if (!proposal || !sourceSignature || !storageKey) {
      setDraftProposals([]);
      setDraftWarnings([]);
      setDraftSourceSignature('');
      setDraftSafetyReady(false);
      return;
    }

    setDraftProposals(readStoredDraft(storageKey, sourceSignature) || proposal.proposals.map((item) => ({ ...item })));
    setDraftWarnings([]);
    setDraftSafetyReady(false);
    setDraftSourceSignature(sourceSignature);
  }, [proposal, sourceSignature, storageKey]);

  useEffect(() => {
    if (!storageKey || !sourceSignature || draftSourceSignature !== sourceSignature) return;
    const value: StoredProposalDraft = { sourceSignature, proposals: draftProposals };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // La propuesta sigue funcionando aunque el navegador no permita sessionStorage.
    }
  }, [draftProposals, draftSourceSignature, sourceSignature, storageKey]);

  const handleDraftProposalsChange = useCallback((nextProposals: AssignmentProposal[]) => {
    setDraftSafetyReady(false);
    setApplyError('');
    setDraftProposals(nextProposals);
  }, []);

  const handleDraftWarningsChange = useCallback((nextWarnings: PlanningProposalDraftWarning[]) => {
    setDraftWarnings(nextWarnings);
    setDraftSafetyReady(true);
  }, []);

  const coveredTaskIds = useMemo(() => {
    const proposalCountByTask = new Map<string, number>();
    draftProposals.forEach((item) => proposalCountByTask.set(item.taskId, (proposalCountByTask.get(item.taskId) || 0) + 1));
    return new Set(tasks
      .filter((task) => (proposalCountByTask.get(task.id) || 0) >= Math.max(1, task.requiredCleaners || 1))
      .map((task) => task.id));
  }, [draftProposals, tasks]);
  const coveredCount = coveredTaskIds.size;
  const completeDraftProposals = useMemo(
    () => draftProposals.filter((item) => coveredTaskIds.has(item.taskId)),
    [coveredTaskIds, draftProposals],
  );
  const uncoveredCount = Math.max(0, (proposal?.summary.totalUnassignedTasks || 0) - coveredCount);
  const blockingWarnings = draftWarnings.filter((warning) => (
    warning.severity === 'blocking'
    && (!warning.taskId || coveredTaskIds.has(warning.taskId))
  ));
  const softWarnings = draftWarnings.filter((warning) => warning.severity === 'warning');
  const canApply = Boolean(
    proposal
    && coveredCount > 0
    && draftSafetyReady
    && !isApplying
    && !isStale
    && blockingWarnings.length === 0
    && !applyInFlightRef.current
  );

  const dateLabel = useMemo(() => {
    const dates = Array.from(new Set(tasks.map((task) => task.date))).sort();
    if (dates.length === 0) return 'el periodo elegido';
    const formatDate = (value: string) => format(parseISO(value), "EEEE, d 'de' MMMM", { locale: es });
    if (dates.length === 1) return formatDate(dates[0]);
    return `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`;
  }, [tasks]);

  const handleApply = async () => {
    if (!canApply || applyInFlightRef.current) return;
    applyInFlightRef.current = true;
    setApplyError('');
    try {
      await onApply(completeDraftProposals);
      if (storageKey) sessionStorage.removeItem(storageKey);
    } catch (error) {
      setApplyError(error instanceof Error
        ? error.message
        : 'No se pudo guardar el reparto. Conservamos la propuesta para que puedas reintentarlo.');
    } finally {
      applyInFlightRef.current = false;
    }
  };

  const handleDiscard = () => {
    if (isApplying || applyInFlightRef.current) return;
    if (storageKey) sessionStorage.removeItem(storageKey);
    onClear();
  };

  if (!proposal) return null;

  const hasBlockingIssue = isStale || blockingWarnings.length > 0;
  const summaryTone = applyError || isStale || blockingWarnings.length > 0 || uncoveredCount > 0
    ? 'border-red-200 bg-red-50 text-red-900'
    : softWarnings.length > 0
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900';

  return (
    <main className="space-y-4 pb-24 md:space-y-5 md:pb-28" aria-busy={isApplying}>
      <header className="rounded-3xl border border-[#310984]/10 bg-white p-4 shadow-lg shadow-[#310984]/8 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#efe9fb] px-3 py-1 text-xs font-semibold text-[#310984]">
              <Sparkles className="h-3.5 w-3.5" /> Propuesta de Hermes
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#171321]">Propuesta para {dateLabel}</h1>
            <p className="mt-1 text-sm text-[#6b627a]">{sedeName ? `${sedeName} · ` : ''}{isPartialScope ? `Alcance parcial: ${tasks.length} de ${totalPendingTaskCount}. ` : ''}Toca una limpieza para cambiar su responsable. Nada se guarda hasta pulsar “Guardar reparto”.</p>
          </div>
          <Badge variant="outline" className="w-fit border-[#310984]/15 bg-[#faf8ff] px-3 py-1 text-[#310984]">
            {coveredCount} cubierta{coveredCount === 1 ? '' : 's'}
          </Badge>
        </div>
      </header>

      <section className={`rounded-2xl border p-4 ${summaryTone}`} aria-live="polite">
        {applyError ? (
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-semibold">No pudimos guardar el reparto.</p><p className="text-sm">{applyError}</p></div>
          </div>
        ) : isStale ? (
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-semibold">Los datos cambiaron.</p><p className="text-sm">Vuelve a planificar para no pisar cambios recientes.</p></div>
          </div>
        ) : blockingWarnings.length > 0 ? (
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-semibold">Hay {blockingWarnings.length} bloqueo{blockingWarnings.length === 1 ? '' : 's'} por corregir.</p><p className="text-sm">Revisa las tarjetas marcadas antes de guardar.</p></div>
          </div>
        ) : uncoveredCount > 0 ? (
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">{uncoveredCount} limpieza{uncoveredCount === 1 ? '' : 's'} sin cubrir.</p>
              <p className="text-sm">Puedes corregirlas o guardar solo las {coveredCount} cubiertas.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-semibold">Todo cubierto.</p><p className="text-sm">Revisa el reparto y aprueba cuando esté correcto.</p></div>
          </div>
        )}
      </section>

      <div className={isApplying ? 'pointer-events-none opacity-70' : ''} aria-disabled={isApplying}>
        <PlanningProposalCalendar
          originalProposals={proposal.proposals}
          draftProposals={draftProposals}
          tasks={tasks}
          calendarTasks={calendarTasks}
          cleaners={cleaners}
          activeCleanerAssignments={activeCleanerAssignments}
          excludedCleanerAssignments={excludedCleanerAssignments}
          isStale={isStale}
          onDraftProposalsChange={handleDraftProposalsChange}
          onDraftWarningsChange={handleDraftWarningsChange}
        />
      </div>

      <details className="group rounded-2xl border border-[#310984]/10 bg-white shadow-sm">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[#310984] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#310984]">
          Ver detalles del plan
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t border-[#310984]/10 p-4 text-sm text-[#6b627a]">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#faf8ff] p-3"><p className="font-semibold text-[#171321]">{coveredCount}</p><p>limpiezas cubiertas</p></div>
            <div className="rounded-xl bg-[#faf8ff] p-3"><p className="font-semibold text-[#171321]">{minutesToHoursLabel(draftProposals.reduce((sum, item) => sum + item.durationMinutes, 0))}</p><p>horas repartidas</p></div>
            <div className="rounded-xl bg-[#faf8ff] p-3"><p className="font-semibold text-[#171321]">{proposal.summary.globalQuality?.globalScore ?? '—'}</p><p>calidad global</p></div>
          </div>
          {proposal.conflicts.length > 0 && (
            <div>
              <p className="font-semibold text-red-800">Sin cubrir</p>
              <ul className="mt-2 space-y-1 text-red-700">{proposal.conflicts.map((conflict) => <li key={`${conflict.taskId}-${conflict.code}`}>• {conflict.message}</li>)}</ul>
            </div>
          )}
          {softWarnings.length > 0 && (
            <div><p className="font-semibold text-amber-900">Avisos operativos</p><ul className="mt-2 space-y-1 text-amber-800">{softWarnings.map((warning) => <li key={warning.id}>• {warning.message}</li>)}</ul></div>
          )}
          <div className="flex items-start gap-2 rounded-xl bg-[#faf8ff] p-3">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#310984]" />
            <p>Tus cambios se guardan en este navegador hasta guardar el reparto o descartar.</p>
          </div>
        </div>
      </details>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#310984]/10 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(49,9,132,0.12)] backdrop-blur md:p-4">
        <div className="mx-auto flex max-w-[1500px] flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" className="min-h-[48px] border-[#310984]/15 text-[#310984]" disabled={isApplying} onClick={handleDiscard}>
            Descartar propuesta
          </Button>
          <div className="flex flex-col gap-2 sm:items-end">
            <p className="text-xs font-semibold text-[#6b627a]">
              Se guardarán {coveredCount} limpieza{coveredCount === 1 ? '' : 's'}{uncoveredCount > 0 ? ` · ${uncoveredCount} quedarán sin responsable` : ''}. Después se iniciarán los avisos.
            </p>
            <Button type="button" className="min-h-[50px] bg-[#310984] px-6 text-base font-semibold text-white hover:bg-[#26066a]" disabled={!canApply} onClick={handleApply}>
              {isApplying
                ? 'Guardando reparto…'
                : uncoveredCount > 0
                  ? `Guardar ${coveredCount} y avisar`
                  : 'Guardar reparto y avisar'}
            </Button>
          </div>
        </div>
      </div>

      {hasBlockingIssue && <p className="sr-only">La aprobación está bloqueada hasta resolver los cambios indicados.</p>}
    </main>
  );
};
