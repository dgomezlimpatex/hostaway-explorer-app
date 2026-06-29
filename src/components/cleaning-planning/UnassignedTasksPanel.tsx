import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cleaner } from '@/types/calendar';
import { CleaningPlanningTask } from '@/types/cleaningPlanning';
import { PlanningTaskCard } from './PlanningTaskCard';

interface UnassignedTasksPanelProps {
  tasks: CleaningPlanningTask[];
  cleaners: Cleaner[];
  onAssign: (taskId: string, cleaner: Cleaner) => void;
  isAssigning?: boolean;
}

export const UnassignedTasksPanel = ({ tasks, cleaners, onAssign, isAssigning }: UnassignedTasksPanelProps) => {
  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader>
        <CardTitle className="text-base">Sin asignar / por planificar</CardTitle>
        <p className="text-sm text-muted-foreground">Tareas que necesitan responsable antes de operar.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.length === 0 ? (
          <div className="rounded-md border border-dashed bg-white p-4 text-center text-sm text-muted-foreground">
            No hay tareas pendientes sin asignar.
          </div>
        ) : (
          tasks.map((task) => (
            <PlanningTaskCard
              key={task.id}
              task={task}
              cleaners={cleaners}
              onAssign={onAssign}
              isAssigning={isAssigning}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
};
