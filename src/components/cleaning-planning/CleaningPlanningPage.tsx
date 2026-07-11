import { useEffect, useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { useCleaningPlanning } from '@/hooks/useCleaningPlanning';
import { useCleaningPlanningActions } from '@/hooks/useCleaningPlanningActions';
import { useCleaningPlanningBuildingData } from '@/hooks/useCleaningPlanningBuildingData';
import { useCleaners } from '@/hooks/useCleaners';
import { useSede } from '@/contexts/SedeContext';
import { Cleaner } from '@/types/calendar';
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
import { isOperationalCleaner, minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { getTodayMadrid } from '@/utils/date';
import { buildAssignmentProposal } from '@/utils/cleaning-planning/proposalEngine';
import { buildProposalSignature } from '@/utils/cleaning-planning/proposalBatchApply';
import { buildPlanningCopilotSnapshot } from '@/services/planning/copilot/planningSnapshot';
import { extractBuildingCode } from '@/services/laundryScheduleService';
import { isTaskAssignedToCleaner } from '@/utils/taskAssignments';
import { AssignmentProposalPanel } from './AssignmentProposalPanel';
import { BuildingTaskBoard } from './BuildingTaskBoard';
import { CleanerLoadTable } from './CleanerLoadTable';
import { CleanerPlanningColumn } from './CleanerPlanningColumn';
import { PlanningAdvancedDetails } from './PlanningAdvancedDetails';
import { PlanningAlertsPanel } from './PlanningAlertsPanel';
import { PlanningCopilotPanel } from './PlanningCopilotPanel';
import { PlanningDecisionQueue } from './PlanningDecisionQueue';
import { PlanningFilters } from './PlanningFilters';
import { PlanningWorkflowGuide } from './PlanningWorkflowGuide';
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
};

const buildProposalContextKey = ({
  activeSedeId,
  cleanerIds,
  availability,
  filters,
  range,
  tasks,
}: {
  activeSedeId?: string;
  cleanerIds: string[];
  availability: Array<{ cleanerId: string; date: string; remainingMinutes: number; isAvailable: boolean }>;
  filters: CleaningPlanningFilters;
  range: { startDate: string; endDate: string };
  tasks: CleaningPlanningTask[];
}): string => JSON.stringify({
  activeSedeId: activeSedeId || 'sin-sede',
  cleanerIds: [...cleanerIds].sort(),
  availability: availability
    .map((item) => `${item.cleanerId}:${item.date}:${item.isAvailable ? 1 : 0}:${item.remainingMinutes}`)
    .sort(),
  filters,
  range,
  tasks: tasks
    .map((task) => `${task.id}:${task.date}:${task.startTime}:${task.endTime}:${task.durationMinutes}:${task.cleanerId || 'sin-asignar'}:${(task.assignments || []).map((assignment) => assignment.cleaner_id).sort().join(',') || 'sin-multi'}:${task.detectedBuilding?.propertyGroupId || 'sin-edificio'}`)
    .sort(),
});

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
    ...task,
    detectedBuilding,
    riskFlags: uniqueRisks([...task.riskFlags, ...buildingRisk]),
  };
});

export const CleaningPlanningPage = () => {
  const [date, setDate] = useState(() => addDays(getTodayMadrid(), 1));
  const [preset, setPreset] = useState<PlanningRangePreset>('today');
  const [filters, setFilters] = useState<CleaningPlanningFilters>(defaultFilters);
  const [proposalState, setProposalState] = useState<ProposalState | null>(null);
  const { planning, range, effectiveAvailability, isLoading, isError, refetch } = useCleaningPlanning({ date, preset });
  const { cleaners, refetch: refetchCleaners } = useCleaners();
  const { activeSede, availableSedes, setActiveSede } = useSede();
  const buildingDataQuery = useCleaningPlanningBuildingData();
  const { applyProposal, assignTask, unassignTask, isAssigning, isApplyingProposal } = useCleaningPlanningActions();

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

  const filteredCount = filteredUnassignedTasks.length + filteredCleanerDays.reduce((total, day) => total + day.tasks.length, 0);
  const filteredTasks = useMemo(
    () => [
      ...filteredUnassignedTasks,
      ...filteredCleanerDays.flatMap((day) => day.tasks),
    ],
    [filteredCleanerDays, filteredUnassignedTasks],
  );
  const manualReviewCount = filteredUnassignedTasks.filter((task) => task.riskFlags.length > 0).length + planning.summary.conflictTasks + planning.summary.overcapacityCleaners;
  const buildingIssueCount = filteredTasks.filter((task) => task.riskFlags.includes('missing-building') || task.riskFlags.includes('ambiguous-building')).length;
  const proposalContextKey = useMemo(() => buildProposalContextKey({
    activeSedeId: activeSede?.id,
    cleanerIds: operationalCleaners.map((cleaner) => cleaner.id),
    availability: effectiveAvailability,
    filters,
    range,
    tasks: filteredUnassignedTasks,
  }), [activeSede?.id, effectiveAvailability, filters, filteredUnassignedTasks, operationalCleaners, range]);
  const proposal = proposalState?.result || null;
  const proposalTasks = proposalState?.tasksSnapshot || filteredUnassignedTasks;
  const hasPartialScope = filteredUnassignedTasks.length !== enhancedUnassignedTasks.length;
  const isProposalStale = Boolean(proposalState && proposalState.contextKey !== proposalContextKey);
  const copilotSnapshot = useMemo(() => buildPlanningCopilotSnapshot({
    activeSede,
    range,
    filters,
    visibleTasks: filteredTasks,
    cleaners: operationalCleaners,
    availability: effectiveAvailability,
    activeProposal: proposal,
  }), [activeSede, effectiveAvailability, filteredTasks, filters, operationalCleaners, proposal, range]);

  useEffect(() => {
    if (filters.cleanerId === 'all') return;
    const cleanerStillAvailable = operationalCleaners.some((cleaner) => cleaner.id === filters.cleanerId);
    if (!cleanerStillAvailable) {
      setFilters((current) => ({ ...current, cleanerId: 'all' }));
      setProposalState(null);
    }
  }, [filters.cleanerId, operationalCleaners]);

  const displayUnassignedTasks = isLoading ? '—' : planning.summary.unassignedTasks;
  const displayUtilization = isLoading ? '—' : `${planning.summary.utilizationPercent}%`;
  const displayManualReviewCount = isLoading ? '—' : manualReviewCount;
  const displayFilteredCount = isLoading ? '—' : filteredCount;
  const displayPlannedMinutes = isLoading ? '—' : minutesToHoursLabel(planning.summary.plannedMinutes);
  const displayCapacityMinutes = isLoading ? '—' : minutesToHoursLabel(planning.summary.capacityMinutes);
  const rangeLabel = range.startDate === range.endDate ? range.startDate : `${range.startDate} → ${range.endDate}`;

  const handleAssign = (taskId: string, cleaner: Cleaner) => assignTask({ taskId, cleaner });
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
    setProposalState({ result: nextProposal, contextKey: proposalContextKey, tasksSnapshot: filteredUnassignedTasks });
    return nextProposal;
  };

  const handleApplyProposal = async (draftProposals?: AssignmentProposal[]) => {
    if (!proposal || proposal.proposals.length === 0 || isProposalStale) return;
    const proposalsToApply = draftProposals && draftProposals.length > 0 ? draftProposals : proposal.proposals;
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
      expectedTasks: proposalTasks,
      freshTasks: freshTasksResult.data,
    });
    setProposalState(null);
    await Promise.all([buildingDataQuery.refetch(), refetchCleaners()]);
  };

  const advancedContent = (
    <>
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

      <PlanningWorkflowGuide
        visibleTasksCount={displayFilteredCount}
        plannedHoursLabel={displayPlannedMinutes}
        capacityHoursLabel={displayCapacityMinutes}
        buildingIssueCount={isLoading ? '—' : buildingIssueCount}
        hasProposal={false}
      />

      {!isLoading && (
        <>
          <PlanningAttentionSummary tasks={filteredTasks} summary={planning.summary} />
          <PlanningCopilotPanel
            snapshot={copilotSnapshot}
            isGenerating={buildingDataQuery.isLoading}
            isApplying={isApplyingProposal}
            onGenerateProposal={handleGenerateProposal}
            onClearProposal={() => setProposalState(null)}
          />
          <PlanningDecisionQueue
            tasks={filteredTasks}
            cleaners={operationalCleaners}
            onAssign={handleAssign}
            onUnassign={unassignTask}
            isAssigning={isAssigning}
          />
          <PlanningAdvancedDetails>
            <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
              <WorkerAvailabilityPanel cleaners={operationalCleaners} availabilities={effectiveAvailability} />
              <div className="space-y-5">
                <PlanningAlertsPanel tasks={filteredTasks} summary={planning.summary} />
                <CleanerLoadTable days={filteredCleanerDays} />
                <BuildingTaskBoard
                  tasks={filteredTasks}
                  cleaners={operationalCleaners}
                  onAssign={handleAssign}
                  onUnassign={unassignTask}
                  isAssigning={isAssigning}
                />
              </div>
            </div>

            <section className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-[#171321]">Carga asignada por limpiadora</h2>
                <p className="text-sm text-[#6b627a]">Detalle completo para auditoría o ajustes finos.</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {filteredCleanerDays.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#310984]/15 bg-white p-6 text-sm text-[#6b627a] xl:col-span-2 2xl:col-span-3">
                    <p className="font-medium text-[#171321]">No hay limpiadoras con tareas para los filtros actuales.</p>
                    <p className="mt-1 text-xs">Limpia búsqueda/filtros, cambia rango o revisa la sede activa para volver a ver la carga asignada.</p>
                  </div>
                ) : filteredCleanerDays.map((day) => (
                  <CleanerPlanningColumn
                    key={day.cleanerId}
                    day={day}
                    cleaners={operationalCleaners}
                    onAssign={handleAssign}
                    onUnassign={unassignTask}
                    isAssigning={isAssigning}
                  />
                ))}
              </div>
            </section>
          </PlanningAdvancedDetails>
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[#f7f5fb] p-3 text-[#171321] md:p-6">
      {proposalState ? (
        <div className="mx-auto max-w-[1500px]">
          <AssignmentProposalPanel
            proposal={proposal}
            tasks={proposalTasks}
            calendarTasks={filteredTasks}
            cleaners={operationalCleaners}
            effectiveAvailability={effectiveAvailability}
            activeCleanerAssignments={buildingData.cleanerAssignments}
            excludedCleanerAssignments={buildingData.excludedCleanerAssignments}
            isApplying={isApplyingProposal}
            isStale={isProposalStale}
            sedeName={activeSede?.nombre}
            isPartialScope={hasPartialScope}
            totalPendingTaskCount={enhancedUnassignedTasks.length}
            onApply={handleApplyProposal}
            onClear={() => setProposalState(null)}
          />
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
          canGenerateProposal={filteredUnassignedTasks.length > 0 && buildingDataReady && !isError && !buildingDataQuery.isError}
          onDateChange={setDate}
          onSedeChange={handleSedeChange}
          onGenerateProposal={handleGenerateProposal}
          onRetry={handleRefresh}
          advancedContent={advancedContent}
        />
      )}
    </div>
  );
};
