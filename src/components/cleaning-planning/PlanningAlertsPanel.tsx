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
      <Alert className="border-emerald-300/30 bg-emerald-400/10 text-emerald-50">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Sin alertas operativas visibles</AlertTitle>
        <AlertDescription>La planificación filtrada no tiene tareas sin cubrir, edificios pendientes ni sobrecargas detectadas.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-amber-300/30 bg-amber-400/10 text-amber-50">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Alertas técnicas de planificación</AlertTitle>
      <AlertDescription>
        <div className="mt-2 flex flex-wrap gap-2">
          {unassigned.length > 0 && <Badge variant="outline" className="border-red-300/30 bg-red-500/10 text-red-100">{unassigned.length} tareas sin cubrir</Badge>}
          {missingBuildings.length > 0 && <Badge variant="outline" className="border-purple-300/30 bg-purple-500/10 text-purple-100">{missingBuildings.length} edificios a revisar</Badge>}
          {conflictTasks.length > 0 && <Badge variant="outline" className="border-amber-300/30 bg-amber-500/10 text-amber-100">{conflictTasks.length} conflictos/capacidad</Badge>}
          {summary.overcapacityCleaners > 0 && (
            <Badge variant="outline" className="border-red-300/30 bg-red-500/10 text-red-100">
              {summary.overcapacityCleaners} limpiadora(s) sobrecargada(s)
            </Badge>
          )}
          {largeHomes.length > 0 && (
            <Badge variant="outline" className="border-sky-300/30 bg-sky-500/10 text-sky-100">
              {largeHomes.length} casa(s) grande(s), {minutesToHoursLabel(largeHomes.reduce((total, task) => total + task.durationMinutes, 0))}: valorar 2–3 limpiadoras
            </Badge>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
