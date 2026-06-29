import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useCleaningPlanning } from '@/hooks/useCleaningPlanning';
import { useCleaners } from '@/hooks/useCleaners';
import { useCleaningPlanningActions } from '@/hooks/useCleaningPlanningActions';
import { Cleaner } from '@/types/calendar';
import { CleaningPlanningFilters, CleaningPlanningTask, PlanningRangePreset } from '@/types/cleaningPlanning';
import { isOperationalCleaner } from '@/utils/cleaningPlanning';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { CleanerPlanningColumn } from './CleanerPlanningColumn';
import { PlanningFilters } from './PlanningFilters';
import { PlanningSummaryCards } from './PlanningSummaryCards';
import { UnassignedTasksPanel } from './UnassignedTasksPanel';

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

  return [task.property, task.address, task.type, task.cleaner, task.zone]
    .filter(Boolean)
    .some((value) => value?.toLowerCase().includes(search));
};

export const CleaningPlanningPage = () => {
  const [date, setDate] = useState(() => new Date());
  const [preset, setPreset] = useState<PlanningRangePreset>('today');
  const [filters, setFilters] = useState<CleaningPlanningFilters>(defaultFilters);
  const { planning, range, isLoading, isError, error, refetch } = useCleaningPlanning({ date, preset });
  const { cleaners } = useCleaners();
  const { assignTask, unassignTask, isAssigning } = useCleaningPlanningActions();

  const operationalCleaners = useMemo(() => cleaners.filter(isOperationalCleaner), [cleaners]);
  const zones = useMemo(() => {
    const allTasks = [
      ...planning.unassignedTasks,
      ...planning.cleaners.flatMap((day) => day.tasks),
    ];
    return Array.from(new Set(allTasks.map((task) => task.zone))).sort();
  }, [planning.cleaners, planning.unassignedTasks]);

  const filteredUnassignedTasks = useMemo(
    () => planning.unassignedTasks.filter((task) => taskMatchesFilters(task, filters)),
    [filters, planning.unassignedTasks],
  );

  const filteredCleanerDays = useMemo(() => planning.cleaners
    .map((day) => ({ ...day, tasks: day.tasks.filter((task) => taskMatchesFilters(task, filters)) }))
    .filter((day) => filters.cleanerId === 'all' || day.cleanerId === filters.cleanerId)
    .filter((day) => day.tasks.length > 0 || filters.taskFilter === 'all'), [filters, planning.cleaners]);

  const filteredCount = filteredUnassignedTasks.length + filteredCleanerDays.reduce((total, day) => total + day.tasks.length, 0);

  const handleAssign = (taskId: string, cleaner: Cleaner) => assignTask({ taskId, cleaner });

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Planificación de limpiezas</h1>
            <p className="text-sm text-muted-foreground">
              Equilibra carga, asigna responsables y detecta solapes antes del operativo.
            </p>
            <p className="text-xs text-muted-foreground">Rango: {range.startDate} → {range.endDate}</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
          </Button>
        </div>

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

        {isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error cargando planificación</AlertTitle>
            <AlertDescription>{error instanceof Error ? error.message : 'No se pudo cargar la planificación.'}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground">Cargando planificación…</div>
        ) : (
          <>
            <div className="sticky top-0 z-10 -mx-4 border-b bg-gray-50/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
              <PlanningSummaryCards summary={planning.summary} />
              <p className="mt-2 text-xs text-muted-foreground">
                Mostrando {filteredCount} tareas con los filtros actuales. Usa “Solo sin asignar” para trabajar la cola operativa.
              </p>
            </div>

            <UnassignedTasksPanel
              tasks={filteredUnassignedTasks}
              cleaners={operationalCleaners}
              onAssign={handleAssign}
              isAssigning={isAssigning}
            />

            <div className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Carga por limpiadora</h2>
                <p className="text-sm text-muted-foreground">Columnas filtradas, ordenadas por riesgo y carga prevista.</p>
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
            </div>
          </>
        )}
      </div>
    </div>
  );
};
