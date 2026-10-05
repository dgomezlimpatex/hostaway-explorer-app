import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CleaningPlanningSummary, CleaningPlanningTask } from '@/types/cleaningPlanning';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface PlanningAlertsPanelProps {
  tasks: CleaningPlanningTask[];
  summary: CleaningPlanningSummary;
}

export const PlanningAlertsPanel = ({ tasks, summary }: PlanningAlertsPanelProps) => {
  const unassigned = tasks.filter((task) => !task.cleanerId);
  const missingBuildings = tasks.filter((task) => task.riskFlags.includes('missing-building') || task.riskFlags.includes('ambiguous-building'));
  const largeHomes = tasks.filter((task) => task.durationMinutes >= 240);
  const conflictTasks = tasks.filter((task) => task.riskFlags.includes('overlap') || task.riskFlags.includes('missing-time') || task.riskFlags.includes('overcapacity'));
  const hasAlerts = unassigned.length > 0 || missingBuildings.length > 0 || largeHomes.length > 0 || conflictTasks.length > 0 || summary.overcapacityCleaners > 0;

  if (!hasAlerts) {
    return (
      <Alert className="border-line bg-surface text-ink">
        <ShieldCheck className="h-4 w-4 text-success" />
        <AlertTitle>Sin alertas operativas visibles</AlertTitle>
        <AlertDescription>La planificación filtrada no tiene tareas sin asignar, edificios pendientes ni sobrecargas detectadas.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-line bg-surface text-ink">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle>Avisos de la planificación</AlertTitle>
      <AlertDescription>
        <div className="mt-2 flex flex-wrap gap-2">
          {unassigned.length > 0 && <Badge variant="outline" className="border-line bg-surface text-ink-2">{unassigned.length} tareas sin asignar</Badge>}
          {missingBuildings.length > 0 && <Badge variant="outline" className="border-line bg-surface text-ink-2">{missingBuildings.length} edificio(s) por revisar</Badge>}
          {conflictTasks.length > 0 && <Badge variant="outline" className="border-line bg-surface text-ink-2">{conflictTasks.length} choque(s) de horario o exceso de horas</Badge>}
          {summary.overcapacityCleaners > 0 && (
            <Badge variant="outline" className="border-line bg-surface text-ink-2">
              {summary.overcapacityCleaners} trabajadora(s) con demasiadas horas
            </Badge>
          )}
          {largeHomes.length > 0 && (
            <Badge variant="outline" className="border-line bg-surface text-ink-2">
              {largeHomes.length} casa(s) grande(s), {minutesToHoursLabel(largeHomes.reduce((total, task) => total + task.durationMinutes, 0))}: puede necesitar 2–3 trabajadoras
            </Badge>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
