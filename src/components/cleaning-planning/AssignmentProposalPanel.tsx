import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock3, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { Cleaner } from '@/types/calendar';
import { AssignmentProposal, AssignmentProposalResult, CleaningPlanningTask, EffectiveWorkerAvailability } from '@/types/cleaningPlanning';
import { CleanerGroupAssignment } from '@/types/propertyGroups';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { buildProposalSignature } from '@/utils/cleaning-planning/proposalBatchApply';
import { PlanningProposalCalendar, PlanningProposalDraftWarning } from './PlanningProposalCalendar';
import { PlanningSteps } from './PlanningSteps';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { usePlanningScrollChrome } from '@/hooks/usePlanningScrollChrome';

interface AssignmentProposalPanelProps {
  draftScopeKey?: string;
  selectedDay?: string;
  proposal: AssignmentProposalResult | null;
  tasks: CleaningPlanningTask[];
  calendarTasks?: CleaningPlanningTask[];
  cleaners?: Cleaner[];
  effectiveAvailability?: EffectiveWorkerAvailability[];
  activeCleanerAssignments?: CleanerGroupAssignment[];
  excludedCleanerAssignments?: CleanerGroupAssignment[];
  isApplying?: boolean;
  isStale?: boolean;
  sedeName?: string;
  isPartialScope?: boolean;
  totalPendingTaskCount?: number;
  savedTaskIds?: string[];
  onTaskSaved?: (taskId: string) => void;
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
  draftScopeKey = '',
  selectedDay,
  proposal,
  tasks,
  calendarTasks = tasks,
  cleaners = [],
  effectiveAvailability = [],
  activeCleanerAssignments = [],
  excludedCleanerAssignments = [],
  isApplying = false,
  isStale = false,
  sedeName,
  isPartialScope = false,
  totalPendingTaskCount = 0,
  savedTaskIds = [],
  onTaskSaved,
  onApply,
  onClear,
}: AssignmentProposalPanelProps) => {
  const { state: sidebarState, isMobile } = useSidebar();
  const chrome = usePlanningScrollChrome(selectedDay);
  const [draftProposals, setDraftProposals] = useState<AssignmentProposal[]>([]);
  const [draftWarnings, setDraftWarnings] = useState<PlanningProposalDraftWarning[]>([]);
  const [draftSourceSignature, setDraftSourceSignature] = useState('');
  const [applyError, setApplyError] = useState('');
  const [quickChangesSaved, setQuickChangesSaved] = useState(false);
  const [draftSafetyReady, setDraftSafetyReady] = useState(false);
  const applyInFlightRef = useRef(false);

  const sourceSignature = useMemo(
    () => (proposal ? `${draftScopeKey}:${buildProposalSignature(proposal.proposals)}` : ''),
    [proposal, draftScopeKey],
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

    let restored = readStoredDraft(storageKey, sourceSignature);
    // Preserve drafts opened before date-scoped navigation was introduced.
    const previousSignature = buildProposalSignature(proposal.proposals);
    if (!restored && previousSignature) {
      const previousKey = storageKeyForSignature(previousSignature);
      restored = readStoredDraft(previousKey, previousSignature);
      if (restored) {
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({sourceSignature, proposals:restored}));
          sessionStorage.removeItem(previousKey);
        } catch { /* Keep the restored draft usable if storage is unavailable. */ }
      }
    }
    setQuickChangesSaved(false);
    setDraftProposals(restored || proposal.proposals.map((item) => ({ ...item })));
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
    return new Set(calendarTasks
      .filter((task) => (proposalCountByTask.get(task.id) || 0) >= Math.max(1, task.requiredCleaners || 1))
      .map((task) => task.id));
  }, [draftProposals, calendarTasks]);
  const coveredCount = coveredTaskIds.size;
  const pendingTaskIds = useMemo(() => new Set(tasks.map((task) => task.id)), [tasks]);
  const coveredPendingCount = Array.from(coveredTaskIds).filter((taskId) => pendingTaskIds.has(taskId)).length;
  const editedExistingCount = coveredCount - coveredPendingCount;
  const completeDraftProposals = useMemo(
    () => draftProposals.filter((item) => coveredTaskIds.has(item.taskId)),
    [coveredTaskIds, draftProposals],
  );
  const uncoveredCount = Math.max(0, (proposal?.summary.totalUnassignedTasks || 0) - coveredPendingCount);
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
    if (selectedDay) return format(parseISO(selectedDay), "EEEE, d 'de' MMMM", { locale: es });
    const dates = Array.from(new Set(tasks.map((task) => task.date))).sort();
    if (dates.length === 0) return 'el periodo elegido';
    const formatDate = (value: string) => format(parseISO(value), "EEEE, d 'de' MMMM", { locale: es });
    if (dates.length === 1) return formatDate(dates[0]);
    return `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`;
  }, [tasks, selectedDay]);

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

  const hasNoDraftAssignments = draftProposals.length === 0 && !isStale;
  const hasOnlySavedQuickChanges = quickChangesSaved && hasNoDraftAssignments;
  const hasBlockingIssue = isStale || blockingWarnings.length > 0;
  return (
    <main className="space-y-4 pb-48 md:space-y-3 md:pb-24" aria-busy={isApplying}>
      <div data-planning-chrome data-collapsed={chrome.collapsed} aria-hidden={chrome.collapsed} className="planner-scroll-chrome">
      <div className="min-h-0 overflow-hidden">
      <header className="planner-stage-hero min-h-0 overflow-hidden rounded-2xl border border-line bg-white shadow-sober">
        <div className="grid gap-3 px-4 py-3 md:gap-3 md:px-4 md:py-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
              <span aria-hidden="true" className="h-px w-5 shrink-0 bg-brand/60" />
              <span className="truncate">{sedeName || 'Planificación diaria'}</span>
            </p>
            <h1 data-planner-proposal-title tabIndex={-1} className="mt-1 text-balance text-xl font-semibold tracking-tight text-ink focus:outline-none md:text-xl">
              {selectedDay ? `Reparto del ${dateLabel}` : `Reparto · ${dateLabel}`}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-5 lg:mt-0.5 text-ink-3">
              {isPartialScope && <span className="font-medium text-warning">Vista parcial: {tasks.length} de {totalPendingTaskCount} limpiezas. </span>}
              El borrador se guarda al confirmar; los ajustes rápidos se aplican al momento.
            </p>
          </div>

          <div role="group" aria-label="Estado del reparto" className="flex flex-wrap items-center gap-y-3 border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="pr-5">
              <p className="text-2xl font-semibold leading-none tracking-tight tabular-nums text-success">{coveredPendingCount}</p>
              <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">Cubiertas</p>
            </div>
            {editedExistingCount > 0 && (
              <div className="border-l border-line px-5">
                <p className="text-2xl font-semibold leading-none tracking-tight tabular-nums text-ink">{editedExistingCount}</p>
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">Ajustadas</p>
              </div>
            )}
            {uncoveredCount > 0 && (
              <div className="border-l border-line px-5">
                <p className="text-2xl font-semibold leading-none tracking-tight tabular-nums text-warning">{uncoveredCount}</p>
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">Sin asignar</p>
              </div>
            )}
            {blockingWarnings.length > 0 && (
              <div className="border-l border-line px-5 pr-0">
                <p className="text-2xl font-semibold leading-none tracking-tight tabular-nums text-danger">{blockingWarnings.length}</p>
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">Bloqueos</p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-line-soft px-5 md:px-4">
          <PlanningSteps current={2} compact className="py-1.5 [&>li]:pt-1.5 [&>li]:gap-2 [&>li>span:first-child]:h-5 [&>li>span:first-child]:w-5" />
        </div>
      </header>
      </div>
      </div>

      {(applyError || isStale || blockingWarnings.length > 0) && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900" aria-live="polite">
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
          ) : (
            <div className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div><p className="font-semibold">Hay {blockingWarnings.length} bloqueo{blockingWarnings.length === 1 ? '' : 's'} por corregir.</p><p className="text-sm">Revisa las tarjetas marcadas antes de guardar.</p></div>
            </div>
          )}
        </section>
      )}

      <div className={isApplying ? 'pointer-events-none opacity-70' : ''} aria-disabled={isApplying}>
        <PlanningProposalCalendar
          chromeCollapsed={chrome.collapsed}
          onTimelineVerticalScroll={(top) => chrome.onScroll(top, 'timeline')}
          selectedDay={selectedDay}
          originalProposals={proposal.proposals}
          draftProposals={draftProposals}
          tasks={tasks}
          calendarTasks={calendarTasks}
          cleaners={cleaners}
          effectiveAvailability={effectiveAvailability}
          activeCleanerAssignments={activeCleanerAssignments}
          excludedCleanerAssignments={excludedCleanerAssignments}
          isStale={isStale}
          savedTaskIds={savedTaskIds}
          onTaskSaved={(taskId) => { setQuickChangesSaved(true); onTaskSaved?.(taskId); }}
          onDraftProposalsChange={handleDraftProposalsChange}
          onDraftWarningsChange={handleDraftWarningsChange}
        />
      </div>

      <Accordion type="single" collapsible className="planner-accordion rounded-lg border border-line bg-white shadow-sm">
        <AccordionItem value="proposal-details" className="border-b-0">
          <AccordionTrigger className="min-h-[48px] gap-3 px-4 py-3 text-left text-sm font-semibold text-brand no-underline hover:no-underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">
            Ver detalles del plan
          </AccordionTrigger>
          <AccordionContent className="planner-disclosure-content border-t border-line px-4 text-sm text-ink-3">
            <div className="space-y-4 pt-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-paper p-3"><p className="font-semibold text-ink">{coveredCount}</p><p>limpiezas cubiertas</p></div>
                <div className="rounded-md bg-paper p-3"><p className="font-semibold text-ink">{minutesToHoursLabel(draftProposals.reduce((sum, item) => sum + item.durationMinutes, 0))}</p><p>horas repartidas</p></div>
                <div className="rounded-md bg-paper p-3"><p className="font-semibold text-ink">{proposal.summary.globalQuality?.globalScore ?? '—'}</p><p>encaje del reparto</p></div>
              </div>
              {proposal.conflicts.length > 0 && (
                <div>
                  <p className="font-semibold text-red-800">Sin asignar</p>
                  <ul className="mt-2 space-y-1 text-red-700">{proposal.conflicts.map((conflict) => <li key={`${conflict.taskId}-${conflict.code}`}>• {conflict.message}</li>)}</ul>
                </div>
              )}
              {softWarnings.length > 0 && (
                <div><p className="font-semibold text-amber-900">Avisos operativos</p><ul className="mt-2 space-y-1 text-amber-800">{softWarnings.map((warning) => <li key={warning.id}>• {warning.message}</li>)}</ul></div>
              )}
              <div className="flex items-start gap-2 rounded-md bg-paper p-3">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <p>Tus cambios se guardan en este navegador hasta guardar el reparto o descartar.</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(49,9,132,0.12)] backdrop-blur transition-[left] duration-200 md:px-4 md:py-2"
        style={{ left: isMobile ? 0 : sidebarState === 'expanded' ? '18rem' : '4rem' }}
      >
        <div className="mx-auto flex w-full max-w-[1920px] flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" className="min-h-[44px] border-line text-brand" disabled={isApplying} onClick={handleDiscard}>
            Descartar propuesta
          </Button>
          <div className="flex flex-col gap-2 sm:items-end lg:flex-row lg:items-center lg:gap-4">
            <p className="text-xs font-semibold text-ink-3">
              {hasOnlySavedQuickChanges
                ? 'Los ajustes rápidos ya están guardados. Puedes seguir reajustando el reparto.'
                : hasNoDraftAssignments
                  ? 'No hay nuevas asignaciones para guardar. Las limpiezas sin responsable siguen disponibles en el tablero.'
                : <>Se guardarán {coveredCount} limpieza{coveredCount === 1 ? '' : 's'}{uncoveredCount > 0 ? ` · ${uncoveredCount} quedarán sin responsable` : ''}. Después se iniciarán los avisos.</>}
            </p>
            <Button
              type="button"
              aria-busy={isApplying}
              className="relative isolate min-h-[44px] overflow-hidden bg-ink px-6 text-base font-semibold text-white hover:bg-black"
              disabled={!canApply}
              onClick={handleApply}
            >
              {isApplying && <span aria-hidden="true" className="planner-save-progress absolute inset-0 bg-white/20" />}
              <span className="relative z-10">
                {isApplying
                  ? 'Guardando reparto…'
                  : hasOnlySavedQuickChanges
                    ? 'Ajustes guardados'
                  : hasNoDraftAssignments
                    ? 'Sin cambios pendientes'
                  : uncoveredCount > 0
                    ? `Guardar ${coveredCount} y avisar`
                    : 'Guardar reparto y avisar'}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {hasBlockingIssue && <p className="sr-only">La aprobación está bloqueada hasta resolver los cambios indicados.</p>}
    </main>
  );
};
