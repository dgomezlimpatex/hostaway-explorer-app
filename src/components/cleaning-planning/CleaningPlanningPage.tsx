import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { buildAssignmentProposal } from '@/utils/cleaning-planning/proposalEngine';
import { buildProposalSignature } from '@/utils/cleaning-planning/proposalBatchApply';
import { buildPlanningCopilotSnapshot } from '@/services/planning/copilot/planningSnapshot';
import { extractBuildingCode } from '@/services/laundryScheduleService';
import { isTaskAssignedToCleaner } from '@/utils/taskAssignments';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { AssignmentProposalPanel } from './AssignmentProposalPanel';
import { BuildingTaskBoard } from './BuildingTaskBoard';
import { CleanerLoadTable } from './CleanerLoadTable';
import { CleanerPlanningColumn } from './CleanerPlanningColumn';
import { PlanningAlertsPanel } from './PlanningAlertsPanel';
import { PlanningCopilotPanel } from './PlanningCopilotPanel';
import { PlanningFilters } from './PlanningFilters';
import { PlanningSummaryCards } from './PlanningSummaryCards';
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
  const [date, setDate] = useState(() => new Date());
  const [preset, setPreset] = useState<PlanningRangePreset>('today');
  const [filters, setFilters] = useState<CleaningPlanningFilters>(defaultFilters);
  const [proposalState, setProposalState] = useState<ProposalState | null>(null);
  const { planning, range, effectiveAvailability, isLoading, isError, error, refetch } = useCleaningPlanning({ date, preset });
  const { cleaners, refetch: refetchCleaners } = useCleaners();
  const { activeSede, availableSedes, setActiveSede } = useSede();
  const buildingDataQuery = useCleaningPlanningBuildingData();
  const { applyProposal, assignTask, unassignTask, isAssigning, isApplyingProposal } = useCleaningPlanningActions();

  const buildingData = buildingDataQuery.data || {
    propertyGroups: [],
    propertyAssignments: [],
    cleanerAssignments: [],
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

  const dayState = isLoading ? 'Cargando planificación' : planning.summary.unassignedTasks === 0 && manualReviewCount === 0 ? 'Día controlado' : 'Revisión operativa';
  const dayStateTone = isLoading
    ? 'border-sky-300/30 bg-sky-400/10 text-sky-100'
    : planning.summary.unassignedTasks === 0 && manualReviewCount === 0
      ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
      : 'border-amber-300/30 bg-amber-400/10 text-amber-100';
  const displayUnassignedTasks = isLoading ? '—' : planning.summary.unassignedTasks;
  const displayUtilization = isLoading ? '—' : `${planning.summary.utilizationPercent}%`;
  const displayManualReviewCount = isLoading ? '—' : manualReviewCount;
  const displayFilteredCount = isLoading ? '—' : filteredCount;
  const displayPlannedMinutes = isLoading ? '—' : minutesToHoursLabel(planning.summary.plannedMinutes);
  const displayCapacityMinutes = isLoading ? '—' : minutesToHoursLabel(planning.summary.capacityMinutes);

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

  const handleApplyProposal = async () => {
    if (!proposal || proposal.proposals.length === 0 || isProposalStale) return;
    const proposalSignature = buildProposalSignature(proposal.proposals);
    const freshTasksResult = await refetch();
    await applyProposal({
      proposals: proposal.proposals,
      proposalSignature,
      activeSedeId: activeSede?.id,
      activeCleanerIds: operationalCleaners.map((cleaner) => cleaner.id),
      expectedTasks: proposalTasks,
      freshTasks: freshTasksResult.data || [],
    });
    setProposalState(null);
    await Promise.all([buildingDataQuery.refetch(), refetchCleaners()]);
  };

  return (
    <div className="min-h-screen bg-[#08090a] p-4 text-white md:p-6">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(49,9,132,0.62),_transparent_34%),linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(255,255,255,0.02))] p-5 shadow-2xl shadow-[#310984]/20 md:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-white/15 bg-white/10 text-white">
                  <Activity className="mr-1 h-3 w-3" /> Centro de control operativo
                </Badge>
                <Badge variant="outline" className={dayStateTone}>{dayState}</Badge>
                <Badge variant="outline" className="border-white/15 bg-black/20 text-white/70">{range.startDate} → {range.endDate}</Badge>
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
                  Planificación V2 por propiedades y edificios
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/62 md:text-base">
                  La pantalla legacy de listado queda sustituida por esta vista V2: horizonte hoy/7/30 días, sede activa, edificios por prefijo/catálogo, alertas y asignación manual confirmada sobre tareas existentes.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/65">Sin asignar</p>
                <p className="mt-2 text-3xl font-semibold">{displayUnassignedTasks}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/65">Balance</p>
                <p className="mt-2 text-3xl font-semibold">{displayUtilization}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/65">Revisión</p>
                <p className="mt-2 text-3xl font-semibold">{displayManualReviewCount}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2 text-xs text-white/65">
              <span>{displayFilteredCount} tareas visibles</span>
              <span>·</span>
              <span>{displayPlannedMinutes} planificadas</span>
              <span>·</span>
              <span>{displayCapacityMinutes} capacidad real</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={handleRefresh} disabled={isLoading || buildingDataQuery.isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" /> Actualizar datos
              </Button>
            </div>
          </div>
        </section>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-3 shadow-xl shadow-black/20">
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
        </div>

        {isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error cargando planificación</AlertTitle>
            <AlertDescription>{error instanceof Error ? error.message : 'No se pudo cargar la planificación.'}</AlertDescription>
          </Alert>
        )}

        {buildingDataQuery.isError && (
          <Alert className="border-amber-300/30 bg-amber-500/10 text-amber-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No se pudieron cargar edificios/equipos</AlertTitle>
            <AlertDescription>La pantalla sigue funcionando, pero la propuesta no tendrá grupos de edificio completos.</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center text-white/55">Cargando centro de control…</div>
        ) : (
          <>
            <PlanningSummaryCards summary={planning.summary} />
            <PlanningAlertsPanel tasks={filteredTasks} summary={planning.summary} />
            <CleanerLoadTable days={filteredCleanerDays} />

            <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)_420px]">
              <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:self-start">
                <WorkerAvailabilityPanel cleaners={operationalCleaners} availabilities={effectiveAvailability} />
              </div>

              <BuildingTaskBoard
                tasks={filteredTasks}
                cleaners={operationalCleaners}
                onAssign={handleAssign}
                onUnassign={unassignTask}
                isAssigning={isAssigning}
              />

              <div className="space-y-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:self-start">
                <PlanningCopilotPanel
                  snapshot={copilotSnapshot}
                  isGenerating={buildingDataQuery.isLoading}
                  isApplying={isApplyingProposal}
                  onGenerateProposal={handleGenerateProposal}
                  onClearProposal={() => setProposalState(null)}
                />
                <AssignmentProposalPanel
                  proposal={proposal}
                  tasks={proposalTasks}
                  isLoading={buildingDataQuery.isLoading}
                  isApplying={isApplyingProposal}
                  isStale={isProposalStale}
                  onGenerate={handleGenerateProposal}
                  onApply={handleApplyProposal}
                  onClear={() => setProposalState(null)}
                />
              </div>
            </div>

            <section className="space-y-3">
              <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-white">Carga asignada por limpiadora</h2>
                  <p className="text-sm text-white/50">Columnas filtradas, ordenadas por riesgo y carga prevista.</p>
                </div>
                <Badge variant="outline" className="w-fit border-white/15 bg-white/5 text-white/65">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Revisión humana antes de guardar
                </Badge>
              </div>
              <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {filteredCleanerDays.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.04] p-6 text-sm text-white/65 xl:col-span-2 2xl:col-span-3">
                    <p className="font-medium text-white/80">No hay limpiadoras con tareas para los filtros actuales.</p>
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
          </>
        )}
      </div>
    </div>
  );
};
