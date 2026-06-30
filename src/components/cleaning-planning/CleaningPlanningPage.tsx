import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCleaningPlanning } from '@/hooks/useCleaningPlanning';
import { useCleaningPlanningActions } from '@/hooks/useCleaningPlanningActions';
import { useCleaningPlanningBuildingData } from '@/hooks/useCleaningPlanningBuildingData';
import { useCleaners } from '@/hooks/useCleaners';
import { Cleaner } from '@/types/calendar';
import {
  AssignmentProposalResult,
  CleaningPlanningFilters,
  CleaningPlanningTask,
  DetectedBuilding,
  PlanningRangePreset,
  PlanningTaskRisk,
} from '@/types/cleaningPlanning';
import { PropertyGroup, PropertyGroupAssignment } from '@/types/propertyGroups';
import { isOperationalCleaner, minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { buildAssignmentProposal } from '@/utils/cleaning-planning/proposalEngine';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { AssignmentProposalPanel } from './AssignmentProposalPanel';
import { BuildingTaskBoard } from './BuildingTaskBoard';
import { CleanerPlanningColumn } from './CleanerPlanningColumn';
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
  if (filters.cleanerId !== 'all' && task.cleanerId !== filters.cleanerId) return false;

  const search = filters.search.trim().toLowerCase();
  if (!search) return true;

  return [task.property, task.address, task.type, task.cleaner, task.zone, task.detectedBuilding?.propertyGroupName]
    .filter(Boolean)
    .some((value) => value?.toLowerCase().includes(search));
};

const uniqueRisks = (risks: PlanningTaskRisk[]): PlanningTaskRisk[] => Array.from(new Set(risks));

const detectBuildingForTask = (
  task: CleaningPlanningTask,
  propertyAssignments: PropertyGroupAssignment[],
  propertyGroups: PropertyGroup[],
): DetectedBuilding => {
  if (!task.propertyId) {
    return {
      status: 'not_detected',
      reason: 'La tarea no tiene propiedad vinculada para inferir edificio automáticamente.',
    };
  }

  const assignments = propertyAssignments.filter((assignment) => assignment.propertyId === task.propertyId);
  if (assignments.length === 0) {
    return {
      status: 'not_detected',
      reason: `La propiedad ${task.propertyCode || task.property} no está vinculada a un grupo/edificio operativo.`,
    };
  }

  const activeGroups = assignments
    .map((assignment) => propertyGroups.find((group) => group.id === assignment.propertyGroupId && group.isActive))
    .filter((group): group is PropertyGroup => Boolean(group));

  if (activeGroups.length === 0) {
    return {
      status: 'not_detected',
      reason: `La propiedad ${task.propertyCode || task.property} está en un grupo inactivo o inexistente.`,
    };
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
  const [proposal, setProposal] = useState<AssignmentProposalResult | null>(null);
  const { planning, range, effectiveAvailability, isLoading, isError, error, refetch } = useCleaningPlanning({ date, preset });
  const { cleaners } = useCleaners();
  const buildingDataQuery = useCleaningPlanningBuildingData();
  const { applyProposal, assignTask, unassignTask, isAssigning, isApplyingProposal } = useCleaningPlanningActions();

  const buildingData = buildingDataQuery.data || {
    propertyGroups: [],
    propertyAssignments: [],
    cleanerAssignments: [],
  };

  const operationalCleaners = useMemo(() => cleaners.filter(isOperationalCleaner), [cleaners]);
  const enhancedUnassignedTasks = useMemo(
    () => enhanceTaskBuildings(planning.unassignedTasks, buildingData.propertyAssignments, buildingData.propertyGroups),
    [buildingData.propertyAssignments, buildingData.propertyGroups, planning.unassignedTasks],
  );
  const enhancedCleanerDays = useMemo(() => planning.cleaners.map((day) => ({
    ...day,
    tasks: enhanceTaskBuildings(day.tasks, buildingData.propertyAssignments, buildingData.propertyGroups),
  })), [buildingData.propertyAssignments, buildingData.propertyGroups, planning.cleaners]);

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
  const manualReviewCount = filteredUnassignedTasks.filter((task) => task.riskFlags.length > 0).length + planning.summary.conflictTasks + planning.summary.overcapacityCleaners;
  const dayState = planning.summary.unassignedTasks === 0 && manualReviewCount === 0 ? 'Día controlado' : 'Revisión operativa';
  const dayStateTone = planning.summary.unassignedTasks === 0 && manualReviewCount === 0
    ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
    : 'border-amber-300/30 bg-amber-400/10 text-amber-100';

  const handleAssign = (taskId: string, cleaner: Cleaner) => assignTask({ taskId, cleaner });
  const handleGenerateProposal = () => {
    const nextProposal = buildAssignmentProposal({
      tasks: filteredUnassignedTasks,
      cleaners: operationalCleaners,
      availability: effectiveAvailability,
      cleanerGroupAssignments: buildingData.cleanerAssignments,
    });
    setProposal(nextProposal);
  };

  const handleApplyProposal = async () => {
    if (!proposal || proposal.proposals.length === 0) return;
    await applyProposal({ proposals: proposal.proposals });
    setProposal(null);
    refetch();
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
                  Planificación diaria de limpiezas
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/62 md:text-base">
                  Reparte la carga con disponibilidad real, edificios detectados y una propuesta revisable antes de guardar nada. Diseñado para que coordinación entienda el operativo en menos de 30 segundos.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Sin asignar</p>
                <p className="mt-2 text-3xl font-semibold">{planning.summary.unassignedTasks}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Balance</p>
                <p className="mt-2 text-3xl font-semibold">{planning.summary.utilizationPercent}%</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Revisión</p>
                <p className="mt-2 text-3xl font-semibold">{manualReviewCount}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2 text-xs text-white/55">
              <span>{filteredCount} tareas visibles</span>
              <span>·</span>
              <span>{minutesToHoursLabel(planning.summary.plannedMinutes)} planificadas</span>
              <span>·</span>
              <span>{minutesToHoursLabel(planning.summary.capacityMinutes)} capacidad real</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-[#310984] text-white shadow-lg shadow-[#310984]/30 hover:bg-[#4c1bb0]"
                disabled={isLoading || buildingDataQuery.isLoading || filteredUnassignedTasks.length === 0}
                onClick={handleGenerateProposal}
              >
                <Wand2 className="mr-2 h-4 w-4" /> Proponer asignación
              </Button>
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
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
            onDateChange={setDate}
            onPresetChange={setPreset}
            onFiltersChange={setFilters}
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

            <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)_420px]">
              <div className="xl:sticky xl:top-4 xl:self-start">
                <WorkerAvailabilityPanel cleaners={operationalCleaners} availabilities={effectiveAvailability} />
              </div>

              <BuildingTaskBoard
                tasks={filteredUnassignedTasks}
                cleaners={operationalCleaners}
                onAssign={handleAssign}
                isAssigning={isAssigning}
              />

              <div className="xl:sticky xl:top-4 xl:self-start">
                <AssignmentProposalPanel
                  proposal={proposal}
                  tasks={filteredUnassignedTasks}
                  isLoading={buildingDataQuery.isLoading}
                  isApplying={isApplyingProposal}
                  onGenerate={handleGenerateProposal}
                  onApply={handleApplyProposal}
                  onClear={() => setProposal(null)}
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
                {filteredCleanerDays.map((day) => (
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
