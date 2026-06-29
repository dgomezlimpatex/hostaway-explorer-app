import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useCleaningPlanning } from '@/hooks/useCleaningPlanning';
import { useCleaners } from '@/hooks/useCleaners';
import { useCleaningPlanningActions } from '@/hooks/useCleaningPlanningActions';
import { PlanningRangePreset } from '@/types/cleaningPlanning';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { CleanerPlanningColumn } from './CleanerPlanningColumn';
import { PlanningFilters } from './PlanningFilters';
import { PlanningSummaryCards } from './PlanningSummaryCards';
import { UnassignedTasksPanel } from './UnassignedTasksPanel';

export const CleaningPlanningPage = () => {
  const [date, setDate] = useState(() => new Date());
  const [preset, setPreset] = useState<PlanningRangePreset>('today');
  const { planning, range, isLoading, isError, error, refetch } = useCleaningPlanning({ date, preset });
  const { cleaners } = useCleaners();
  const { assignTask, unassignTask, isAssigning } = useCleaningPlanningActions();

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

        <PlanningFilters date={date} preset={preset} onDateChange={setDate} onPresetChange={setPreset} />

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
            <PlanningSummaryCards summary={planning.summary} />

            <UnassignedTasksPanel
              tasks={planning.unassignedTasks}
              cleaners={cleaners}
              onAssign={(taskId, cleaner) => assignTask({ taskId, cleaner })}
              isAssigning={isAssigning}
            />

            <div className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Carga por limpiadora</h2>
                <p className="text-sm text-muted-foreground">Columnas ordenadas por riesgo y carga prevista.</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {planning.cleaners.map((day) => (
                  <CleanerPlanningColumn
                    key={day.cleanerId}
                    day={day}
                    cleaners={cleaners}
                    onAssign={(taskId, cleaner) => assignTask({ taskId, cleaner })}
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
