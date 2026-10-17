import { usePlanningSavedTaskContext } from '@/hooks/usePlanningSavedTaskContext';
import { buildProposalContextKey } from '@/utils/cleaning-planning/proposalContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { addDays } from 'date-fns';
import { useCleaningPlanning } from '@/hooks/useCleaningPlanning';
import { useCleaningPlanningActions } from '@/hooks/useCleaningPlanningActions';
import { useCleaningPlanningBuildingData } from '@/hooks/useCleaningPlanningBuildingData';
import { useCleaners } from '@/hooks/useCleaners';
import { useAuth } from '@/hooks/useAuth';
import { usePlanningDraftManager, usePlanningDraftView } from '@/hooks/usePlanningDraft';
import { usePlanningDraftRecovery, type RecoveredDraft } from '@/hooks/usePlanningDraftRecovery';
import { useSede } from '@/contexts/SedeContext';
import {
  AssignmentProposalResult,
  AssignmentProposal,
  CleaningPlanningFilters,
  CleaningPlanningTask,
  DetectedBuilding,
  PlanningRangePreset,
  PlanningTaskRisk,
} from '@/types/cleaningPlanning';
import { PropertyGroup, PropertyGroupAssignment } from '@/types/propertyGroups';
import { Sede } from '@/types/sede';
import { isOperationalCleaner } from '@/utils/cleaningPlanning';
import { getTodayMadrid, formatMadridDate } from '@/utils/date';
import { PlanningDayNavigation } from './PlanningDayNavigation';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildAssignmentProposal } from '@/utils/cleaning-planning/proposalEngine';
import { applyBuildingOperationalWindow } from '@/utils/cleaning-planning/buildingOperationalWindow';
import { buildProposalSignature } from '@/utils/cleaning-planning/proposalBatchApply';
import type { DraftEvaluation } from '@/utils/cleaning-planning/planningDraftRecovery';
import { presetForDraftPeriod } from '@/utils/cleaning-planning/planningDraftText';
import type { DraftSummary } from '@/utils/cleaning-planning/planningDraftStore';
import { PlanningDraftNotice, PlanningDraftOthers, PlanningDraftReport } from './PlanningDraftNotice';
import { extractBuildingCode } from '@/services/laundryScheduleService';
import { isTaskAssignedToCleaner } from '@/utils/taskAssignments';
import { AssignmentProposalPanel } from './AssignmentProposalPanel';
import { CleanerLoadTable } from './CleanerLoadTable';
import { PlanningAdvancedDetails } from './PlanningAdvancedDetails';
import { PlanningAlertsPanel } from './PlanningAlertsPanel';
import { PlanningFilters } from './PlanningFilters';
import { PlanningAttentionSummary } from './PlanningAttentionSummary';
import { PlanningStartScreen } from './PlanningStartScreen';
import { WorkerAvailabilityPanel } from './WorkerAvailabilityPanel';

const defaultFilters: CleaningPlanningFilters = {
  taskFilter: 'all',
  zone: 'all',
  search: '',
  cleanerId: 'all',
};

const taskMatchesFilters = (task: CleaningPlanningTask, filters: CleaningPlanningFilters): boolean => {
  if (filters.taskFilter === 'unassigned' && task.cleanerId) return false;
  if (filters.taskFilter === 'risks' && task.riskFlags.length === 0) return false;
  if (filters.zone !== 'all' && task.zone !== filters.zone) return false;
  if (filters.cleanerId !== 'all' && !isTaskAssignedToCleaner(task, filters.cleanerId)) return false;

  const search = filters.search.trim().toLowerCase();
  if (!search) return true;

  return [task.property, task.propertyCode, task.address, task.type, task.cleaner, task.zone, task.detectedBuilding?.propertyGroupName]
    .filter(Boolean)
    .some((value) => value?.toLowerCase().includes(search));
};

const uniqueRisks = (risks: PlanningTaskRisk[]): PlanningTaskRisk[] => Array.from(new Set(risks));

type ProposalState = {
  result: AssignmentProposalResult;
  contextKey: string;
  tasksSnapshot: CleaningPlanningTask[];
  /** Borrador recuperado de forma explícita (o conservado al cambiar de día); solo se aplica al abrir el reparto. */
  initialDraft?: RecoveredDraft;
  /** Identifica cada recuperación para que el reparto se abra de nuevo con el borrador recuperado. */
  recoveryId?: number;
  /** Resumen de lo recuperado y lo que no, mientras el usuario no lo cierre. */
  recovery?: { recovered: number; total: number; conflicts: DraftEvaluation['conflicts'] };
};

const buildIndividualBuilding = (task: CleaningPlanningTask, codePrefix: string): DetectedBuilding => {
  const label = task.propertyCode || task.property || codePrefix || task.propertyId || task.id;
  return {
    status: 'detected',
    propertyGroupId: `individual:${task.propertyId || label}`,
    propertyGroupName: label,
    matchedPattern: codePrefix || label,
    reason: `Propiedad tratada como centro individual (${label}).`,
  };
};

const detectBuildingForTask = (
  task: CleaningPlanningTask,
  propertyAssignments: PropertyGroupAssignment[],
  propertyGroups: PropertyGroup[],
): DetectedBuilding => {
  const codePrefix = extractBuildingCode(task.propertyCode || task.property || '');
  const prefixMatches = propertyGroups
    .filter((group) => group.isActive)
    .filter((group) => {
      const normalizedName = group.name.trim().toUpperCase();
      return Boolean(codePrefix) && codePrefix !== 'SIN EDIFICIO' && (normalizedName === codePrefix || normalizedName.includes(codePrefix));
    });

  const detectByPrefix = (): DetectedBuilding | null => {
    if (prefixMatches.length === 1) {
      const [group] = prefixMatches;
      return {
        status: 'detected',
        propertyGroupId: group.id,
        propertyGroupName: group.name,
        matchedPattern: codePrefix,
        reason: `Edificio inferido por prefijo de código (${codePrefix}).`,
      };
    }

    if (prefixMatches.length > 1) {
      return {
        status: 'ambiguous',
        matchedPattern: codePrefix,
        reason: `El prefijo ${codePrefix} coincide con varios edificios activos.`,
      };
    }

    return null;
  };

  if (!task.propertyId) {
    return detectByPrefix() || buildIndividualBuilding(task, codePrefix);
  }

  const assignments = propertyAssignments.filter((assignment) => assignment.propertyId === task.propertyId);
  if (assignments.length === 0) {
    return detectByPrefix() || buildIndividualBuilding(task, codePrefix);
  }

  const activeGroups = assignments
    .map((assignment) => propertyGroups.find((group) => group.id === assignment.propertyGroupId && group.isActive))
    .filter((group): group is PropertyGroup => Boolean(group));

  if (activeGroups.length === 0) {
    return detectByPrefix() || buildIndividualBuilding(task, codePrefix);
  }

  if (activeGroups.length > 1) {
    return {
      status: 'ambiguous',
      reason: `La propiedad ${task.propertyCode || task.property} aparece en varios edificios activos.`,
    };
  }

  const [group] = activeGroups;
  return {
    status: 'detected',
    propertyGroupId: group.id,
    propertyGroupName: group.name,
    reason: `Edificio inferido automáticamente por la relación existente de la propiedad (${task.propertyCode || task.property}).`,
  };
};

const enhanceTaskBuildings = (
  tasks: CleaningPlanningTask[],
  propertyAssignments: PropertyGroupAssignment[],
  propertyGroups: PropertyGroup[],
): CleaningPlanningTask[] => tasks.map((task) => {
  const detectedBuilding = detectBuildingForTask(task, propertyAssignments, propertyGroups);
  const buildingRisk: PlanningTaskRisk[] = detectedBuilding.status === 'detected'
    ? []
    : [detectedBuilding.status === 'ambiguous' ? 'ambiguous-building' : 'missing-building'];

  return {
    ...applyBuildingOperationalWindow(task, detectedBuilding, propertyGroups),
    detectedBuilding,
    riskFlags: uniqueRisks([...task.riskFlags, ...buildingRisk]),
  };
});

export const CleaningPlanningPage = () => {
  const [date, setDate] = useState(() => addDays(getTodayMadrid(), 1));
  const [preset, setPreset] = useState<PlanningRangePreset>('today');
  const [filters, setFilters] = useState<CleaningPlanningFilters>(defaultFilters);
  const [proposalState, setProposalState] = useState<ProposalState | null>(null);
  const [calendarNavigation, setCalendarNavigation] = useState(false);
  const [isSavingDay, setIsSavingDay] = useState(false);
  const [isSavedConfirmationOpen, setIsSavedConfirmationOpen] = useState(false);
  const [savedTaskIds, setSavedTaskIds] = useState<string[]>([]);
  const dayProposals = useRef(new Map<string, ProposalState>());
  const { planning, range, effectiveAvailability, isLoading, isError, refetch } = useCleaningPlanning({ date, preset });
  const { cleaners, refetch: refetchCleaners } = useCleaners();
  const { activeSede, availableSedes, setActiveSede } = useSede();
  const dayKey = `${activeSede?.id}:${formatMadridDate(date)}:${preset}:${JSON.stringify(filters)}`;
  const buildingDataQuery = useCleaningPlanningBuildingData();
  const { applyProposal, isApplyingProposal } = useCleaningPlanningActions();

  const buildingData = buildingDataQuery.data || {
    propertyGroups: [],
    propertyAssignments: [],
    cleanerAssignments: [],
    excludedCleanerAssignments: [],
  };
  const buildingDataReady = Boolean(buildingDataQuery.data) && !buildingDataQuery.isLoading;

  const operationalCleaners = useMemo(() => cleaners.filter(isOperationalCleaner), [cleaners]);
  const enhancedUnassignedTasks = useMemo(
    () => (buildingDataReady
      ? enhanceTaskBuildings(planning.unassignedTasks, buildingData.propertyAssignments, buildingData.propertyGroups)
      : planning.unassignedTasks),
    [buildingData.propertyAssignments, buildingData.propertyGroups, buildingDataReady, planning.unassignedTasks],
  );
  const enhancedCleanerDays = useMemo(() => planning.cleaners.map((day) => ({
    ...day,
    tasks: buildingDataReady
      ? enhanceTaskBuildings(day.tasks, buildingData.propertyAssignments, buildingData.propertyGroups)
      : day.tasks,
  })), [buildingData.propertyAssignments, buildingData.propertyGroups, buildingDataReady, planning.cleaners]);

  const zones = useMemo(() => {
    const allTasks = [
      ...enhancedUnassignedTasks,
      ...enhancedCleanerDays.flatMap((day) => day.tasks),
    ];
    return Array.from(new Set(allTasks.map((task) => task.zone))).sort();
  }, [enhancedCleanerDays, enhancedUnassignedTasks]);

  const filteredUnassignedTasks = useMemo(
    () => enhancedUnassignedTasks.filter((task) => taskMatchesFilters(task, filters)),
    [enhancedUnassignedTasks, filters],
  );

  const filteredCleanerDays = useMemo(() => enhancedCleanerDays
    .map((day) => ({ ...day, tasks: day.tasks.filter((task) => taskMatchesFilters(task, filters)) }))
    .filter((day) => filters.cleanerId === 'all' || day.cleanerId === filters.cleanerId)
    .filter((day) => day.tasks.length > 0 || filters.taskFilter === 'all'), [enhancedCleanerDays, filters]);

  const filteredTasks = useMemo(
    () => [
      ...filteredUnassignedTasks,
      ...filteredCleanerDays.flatMap((day) => day.tasks),
    ],
    [filteredCleanerDays, filteredUnassignedTasks],
  );

  const proposalContextKey = useMemo(() => buildProposalContextKey({
    activeSedeId: activeSede?.id,
    cleanerIds: operationalCleaners.map((cleaner) => cleaner.id),
    availability: effectiveAvailability,
    filters,
    range,
    tasks: filteredTasks,
  }), [activeSede?.id, effectiveAvailability, filters, filteredTasks, operationalCleaners, range]);
  const recordSavedTask = usePlanningSavedTaskContext(proposalState?.contextKey, proposalContextKey,
    contextKey => setProposalState(current => current ? { ...current, contextKey } : current), isError);
  const proposal = proposalState?.result || null;
  const proposalTasks = proposalState?.tasksSnapshot || filteredUnassignedTasks;
  const hasPartialScope = filteredUnassignedTasks.length !== enhancedUnassignedTasks.length;
  const isProposalStale = Boolean(proposalState && proposalState.contextKey !== proposalContextKey);

  // Borrador local: identidad = usuario + sede + día (o rango) real de planificación.
  const { user } = useAuth();
  const draftManager = usePlanningDraftManager();
  const draftIdentity = useMemo(() => (user?.id && activeSede?.id
    ? { userId: user.id, sedeId: activeSede.id, startDate: range.startDate, endDate: range.endDate }
    : null), [user?.id, activeSede?.id, range.startDate, range.endDate]);
  const draftView = usePlanningDraftView(draftManager, draftIdentity);
  const allPlanningTasks = useMemo(
    () => [...enhancedUnassignedTasks, ...enhancedCleanerDays.flatMap((day) => day.tasks)],
    [enhancedCleanerDays, enhancedUnassignedTasks],
  );
  const draftDataReady = !isLoading && !isError && buildingDataReady && !buildingDataQuery.isError;
  const latestPlanning = useRef({ filteredUnassignedTasks, operationalCleaners, effectiveAvailability, cleanerAssignments: buildingData.cleanerAssignments, proposalContextKey });
  latestPlanning.current = { filteredUnassignedTasks, operationalCleaners, effectiveAvailability, cleanerAssignments: buildingData.cleanerAssignments, proposalContextKey };
  const latestDrafts = useRef<Record<string, RecoveredDraft>>({});
  const recoveryCounter = useRef(0);

  const presentProposal = (next: ProposalState) => {
    const showProposal = () => {
      flushSync(() => setProposalState(next));
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    const focusHeading = () => {
      // No quitar el foco a quien ya empezó a navegar mientras terminaba la transición.
      if (document.activeElement === document.body || document.activeElement === document.documentElement) {
        document.querySelector<HTMLElement>('[data-planner-proposal-title]')?.focus({ preventScroll: true });
      }
    };
    if (typeof document.startViewTransition === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Mantiene continuidad entre la cabecera de preparación y el tablero, sin retrasar la propuesta.
      void document.startViewTransition(showProposal).finished.then(focusHeading, focusHeading);
    } else {
      showProposal();
      focusHeading();
    }
  };

  /** Abre el reparto con el borrador que el usuario ha elegido recuperar. No guarda nada en las tareas. */
  const handleDraftRecovered = (draft: RecoveredDraft, evaluation: DraftEvaluation) => {
    const current = latestPlanning.current;
    const result = buildAssignmentProposal({
      tasks: current.filteredUnassignedTasks,
      cleaners: current.operationalCleaners,
      availability: current.effectiveAvailability,
      cleanerGroupAssignments: current.cleanerAssignments,
    });
    recoveryCounter.current += 1;
    presentProposal({
      result,
      contextKey: current.proposalContextKey,
      tasksSnapshot: current.filteredUnassignedTasks,
      initialDraft: draft,
      recoveryId: recoveryCounter.current,
      recovery: { recovered: evaluation.recoveredTaskCount, total: evaluation.totalTaskCount, conflicts: evaluation.conflicts },
    });
  };

  const draftRecovery = usePlanningDraftRecovery({
    manager: draftManager,
    identity: draftIdentity,
    view: draftView,
    ready: draftDataReady,
    allTasks: allPlanningTasks,
    scopeTasks: filteredTasks,
    cleaners: operationalCleaners,
    availability: effectiveAvailability,
    excludedCleanerAssignments: buildingData.excludedCleanerAssignments,
    refreshTasks: async () => {
      const fresh = await refetch();
      return fresh.isError || !fresh.data ? null : fresh.data;
    },
    onRecovered: handleDraftRecovered,
  });

  useEffect(() => {
    if (filters.cleanerId === 'all') return;
    const cleanerStillAvailable = operationalCleaners.some((cleaner) => cleaner.id === filters.cleanerId);
    if (!cleanerStillAvailable) {
      setFilters((current) => ({ ...current, cleanerId: 'all' }));
      setProposalState(null);
    }
  }, [filters.cleanerId, operationalCleaners]);

  const rangeLabel = range.startDate === range.endDate ? range.startDate : `${range.startDate} → ${range.endDate}`;

  const handleSedeChange = (sede: Sede) => {
    setFilters(defaultFilters);
    setProposalState(null);
    setActiveSede(sede);
  };

  const handleRefresh = () => {
    setProposalState(null);
    void refetch();
    void buildingDataQuery.refetch();
    void refetchCleaners();
  };

  const handleGenerateProposal = (): AssignmentProposalResult => {
    const nextProposal = buildAssignmentProposal({
      tasks: filteredUnassignedTasks,
      cleaners: operationalCleaners,
      availability: effectiveAvailability,
      cleanerGroupAssignments: buildingData.cleanerAssignments,
    });
    presentProposal({ result: nextProposal, contextKey: proposalContextKey, tasksSnapshot: filteredUnassignedTasks });
    return nextProposal;
  };

  const handleCalendarDateChange = (nextDate: Date) => {
    if (isSavingDay || isApplyingProposal || formatMadridDate(nextDate) === formatMadridDate(date)) return;
    if (proposalState) dayProposals.current.set(dayKey, { ...proposalState, recovery: undefined, initialDraft: latestDrafts.current[dayKey] ?? proposalState.initialDraft });
    setProposalState(null);
    setCalendarNavigation(true);
    setPreset('today');
    setDate(nextDate);
  };

  useEffect(() => {
    if (!calendarNavigation || isLoading || isError || !buildingDataReady || buildingDataQuery.isError) return;
    if (range.startDate !== formatMadridDate(date) || range.endDate !== range.startDate) return;
    const cached = dayProposals.current.get(dayKey);
    const result = cached ?? {
      result: buildAssignmentProposal({tasks:filteredUnassignedTasks,cleaners:operationalCleaners,availability:effectiveAvailability,cleanerGroupAssignments:buildingData.cleanerAssignments}),
      contextKey:proposalContextKey,
      tasksSnapshot:filteredUnassignedTasks,
    };
    setProposalState(result);
    setCalendarNavigation(false);
  }, [calendarNavigation,isLoading,isError,buildingDataReady,buildingDataQuery.isError,range.startDate,range.endDate,date,dayKey,filteredUnassignedTasks,operationalCleaners,effectiveAvailability,buildingData.cleanerAssignments,proposalContextKey]);

  const handleApplyProposal = async (draftProposals?: AssignmentProposal[]) => {
    if (!proposal || isProposalStale) return;
    setIsSavingDay(true);
    try {
    const proposalsToApply = draftProposals ?? proposal.proposals;
    if (proposalsToApply.length === 0) return;
    const proposalSignature = buildProposalSignature(proposalsToApply);
    const freshTasksResult = await refetch();
    if (freshTasksResult.isError || !freshTasksResult.data) {
      throw new Error('No se pudo verificar el reparto actual. No se guardó ningún cambio; inténtalo de nuevo cuando haya conexión.');
    }
    await applyProposal({
      proposals: proposalsToApply,
      proposalSignature,
      activeSedeId: activeSede?.id,
      activeCleanerIds: operationalCleaners.map((cleaner) => cleaner.id),
      expectedTasks: filteredTasks,
      freshTasks: freshTasksResult.data,
    });
    dayProposals.current.delete(dayKey);
    await Promise.all([buildingDataQuery.refetch(), refetchCleaners()]);
    setSavedTaskIds(proposalsToApply.map((item) => item.taskId));
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 160));
    }
    setIsSavedConfirmationOpen(true);
    } finally {
      setIsSavingDay(false);
    }
  };

  const handleDraftSnapshot = useCallback((draft: RecoveredDraft) => {
    latestDrafts.current[dayKey] = draft;
  }, [dayKey]);

  const handleOpenDraftPeriod = (summary: DraftSummary) => {
    const nextPreset = presetForDraftPeriod(summary.identity.startDate, summary.identity.endDate);
    if (!nextPreset) return;
    setPreset(nextPreset);
    setDate(new Date(`${summary.identity.startDate}T12:00:00`));
  };

  const draftNoticeNode = (variant: 'start' | 'panel') => (
    <PlanningDraftNotice
      variant={variant}
      view={draftView}
      evaluation={draftRecovery.evaluation}
      busy={draftRecovery.busy}
      error={draftRecovery.error}
      onRecover={() => { void draftRecovery.recover(); }}
      onDiscard={() => { draftRecovery.discard(); }}
    />
  );

  const advancedContent = (
    <div className="space-y-5">
      <div className="rounded-lg border border-line bg-white p-4 text-sm text-ink-3">
        <p className="font-semibold text-ink">Solo necesitas esto si quieres buscar o revisar detalles.</p>
        <p className="mt-1">Para preparar el reparto del día, vuelve arriba y pulsa «Preparar el reparto».</p>
      </div>
      <PlanningFilters
        date={date}
        preset={preset}
        filters={filters}
        zones={zones}
        cleaners={operationalCleaners.map((cleaner) => ({ id: cleaner.id, name: cleaner.name }))}
        activeSedeId={activeSede?.id}
        availableSedes={availableSedes}
        onDateChange={setDate}
        onPresetChange={setPreset}
        onFiltersChange={setFilters}
        onSedeChange={handleSedeChange}
      />

      {!isLoading && (
        <>
          <PlanningAttentionSummary tasks={filteredTasks} summary={planning.summary} />
          <PlanningAdvancedDetails>
            <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
              <WorkerAvailabilityPanel cleaners={operationalCleaners} availabilities={effectiveAvailability} />
              <div className="space-y-5">
                <PlanningAlertsPanel tasks={filteredTasks} summary={planning.summary} />
                <CleanerLoadTable days={filteredCleanerDays} />
              </div>
            </div>
          </PlanningAdvancedDetails>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-paper p-3 text-ink md:p-3">
      {(proposalState || calendarNavigation) && <div className="mx-auto w-full max-w-none"><PlanningDayNavigation date={date} disabled={isApplyingProposal || isSavingDay} onChange={handleCalendarDateChange} /></div>}
      {proposalState ? (
        <div className="mx-auto w-full max-w-none">
          <AssignmentProposalPanel
            key={`${dayKey}:${proposalState.recoveryId ?? 0}`}
            draftScopeKey={dayKey}
            draftStore={{ manager: draftManager, identity: draftIdentity }}
            initialDraft={proposalState.initialDraft}
            onDraftSnapshot={handleDraftSnapshot}
            draftNotice={(
              <>
                {draftNoticeNode('panel')}
                {proposalState.recovery && (
                  <PlanningDraftReport
                    recovered={proposalState.recovery.recovered}
                    total={proposalState.recovery.total}
                    conflicts={proposalState.recovery.conflicts}
                    onClose={() => setProposalState((current) => (current ? { ...current, recovery: undefined } : current))}
                  />
                )}
              </>
            )}
            selectedDay={range.startDate === range.endDate ? range.startDate : undefined}
            proposal={proposal}
            tasks={proposalTasks}
            calendarTasks={filteredTasks}
            cleaners={operationalCleaners}
            effectiveAvailability={effectiveAvailability}
            activeCleanerAssignments={buildingData.cleanerAssignments}
            excludedCleanerAssignments={buildingData.excludedCleanerAssignments}
            isApplying={isApplyingProposal || isSavingDay}
            isStale={isProposalStale}
            sedeName={activeSede?.nombre}
            isPartialScope={hasPartialScope}
            totalPendingTaskCount={enhancedUnassignedTasks.length}
            savedTaskIds={savedTaskIds}
            onTaskSaved={recordSavedTask}
            onApply={handleApplyProposal}
            onClear={() => {dayProposals.current.delete(dayKey);setProposalState(null);setCalendarNavigation(false);}}
          />
        </div>
      ) : calendarNavigation ? (
        <div className="mx-auto max-w-none rounded-lg border bg-white p-8" role="status">
          {isError || buildingDataQuery.isError ? <><p>No se pudo cargar este día. Tu borrador anterior se conserva.</p><Button variant="outline" onClick={()=>{void refetch();void buildingDataQuery.refetch();}}>Reintentar</Button></> : 'Cargando calendario…'}
        </div>
      ) : (
        <PlanningStartScreen
          date={date}
          activeSede={activeSede}
          availableSedes={availableSedes}
          pendingTaskCount={filteredUnassignedTasks.length}
          totalPendingTaskCount={enhancedUnassignedTasks.length}
          scopeLabel={range.startDate === range.endDate ? '1 día' : rangeLabel}
          isLoading={isLoading || buildingDataQuery.isLoading}
          isError={isError}
          buildingDataError={buildingDataQuery.isError}
          canGenerateProposal={filteredTasks.length > 0 && buildingDataReady && !isError && !buildingDataQuery.isError}
          onDateChange={setDate}
          onSedeChange={handleSedeChange}
          onGenerateProposal={handleGenerateProposal}
          onRetry={handleRefresh}
          advancedContent={advancedContent}
          draftNotice={(
            <>
              {draftNoticeNode('start')}
              <PlanningDraftOthers
                others={draftView.others}
                onOpen={handleOpenDraftPeriod}
                canOpen={(summary) => presetForDraftPeriod(summary.identity.startDate, summary.identity.endDate) !== null}
              />
              {draftView.corruptRemoved && draftIdentity && (
                <p role="status" className="rounded-lg border border-line bg-paper p-3 text-sm text-ink-3">
                  Había un borrador dañado en este navegador y se ha eliminado.{' '}
                  <button type="button" className="font-semibold text-brand underline underline-offset-2" onClick={() => draftManager.dismissCorruptNotice(draftIdentity)}>Entendido</button>
                </p>
              )}
              {!draftView.storageAvailable && (
                <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Este navegador no permite guardar borradores: si cierras o recargas, perderás el reparto sin guardar.
                </p>
              )}
            </>
          )}
        />
      )}
      <Dialog
        open={isSavedConfirmationOpen}
        onOpenChange={(open) => {
          setIsSavedConfirmationOpen(open);
          if (!open) {
            setSavedTaskIds([]);
            setProposalState(null);
            setCalendarNavigation(false);
          }
        }}
      >
        <DialogContent className="planner-success-dialog max-w-sm rounded-2xl border-line shadow-xl [&>button.absolute]:hidden">
          <DialogHeader className="items-center text-center">
            <span aria-hidden="true" className="mb-2 grid h-14 w-14 place-items-center rounded-full bg-line-soft text-brand">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <DialogTitle>¡Reparto guardado!</DialogTitle>
            <DialogDescription>
              Los cambios se han aplicado correctamente. Al continuar volverás al resumen del día.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              className="min-h-[44px] w-full bg-brand text-white hover:bg-ink"
              onClick={() => {
                setIsSavedConfirmationOpen(false);
                setSavedTaskIds([]);
                setProposalState(null);
                setCalendarNavigation(false);
              }}
            >
              Volver al día
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
