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
      <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Sin alertas operativas visibles</AlertTitle>
        <AlertDescription>La planificación filtrada no tiene tareas sin asignar, edificios pendientes ni sobrecargas detectadas.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-900">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Avisos de la planificación</AlertTitle>
      <AlertDescription>
        <div className="mt-2 flex flex-wrap gap-2">
          {unassigned.length > 0 && <Badge variant="outline" className="border-red-200 bg-red-100 text-red-800">{unassigned.length} tareas sin asignar</Badge>}
          {missingBuildings.length > 0 && <Badge variant="outline" className="border-purple-200 bg-purple-100 text-purple-800">{missingBuildings.length} edificio(s) por revisar</Badge>}
          {conflictTasks.length > 0 && <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900">{conflictTasks.length} choque(s) de horario o exceso de horas</Badge>}
          {summary.overcapacityCleaners > 0 && (
            <Badge variant="outline" className="border-red-200 bg-red-100 text-red-800">
              {summary.overcapacityCleaners} trabajadora(s) con demasiadas horas
            </Badge>
          )}
          {largeHomes.length > 0 && (
            <Badge variant="outline" className="border-sky-200 bg-sky-100 text-sky-800">
              {largeHomes.length} casa(s) grande(s), {minutesToHoursLabel(largeHomes.reduce((total, task) => total + task.durationMinutes, 0))}: puede necesitar 2–3 trabajadoras
            </Badge>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
