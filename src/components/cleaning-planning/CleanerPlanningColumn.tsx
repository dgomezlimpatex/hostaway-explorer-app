import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Cleaner } from '@/types/calendar';
import { CleanerPlanningDay } from '@/types/cleaningPlanning';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { PlanningTaskCard } from './PlanningTaskCard';

interface CleanerPlanningColumnProps {
  day: CleanerPlanningDay;
  cleaners: Cleaner[];
  onAssign: (taskId: string, cleaner: Cleaner) => void;
  onUnassign: (taskId: string) => void;
  isAssigning?: boolean;
}

export const CleanerPlanningColumn = ({ day, cleaners, onAssign, onUnassign, isAssigning }: CleanerPlanningColumnProps) => {
  const progressValue = Math.min(day.utilizationPercent, 140);
  const isOverloaded = day.riskFlags.includes('overcapacity');

  return (
    <Card className="min-w-[320px]">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{day.cleanerName}</CardTitle>
            <p className="text-xs text-muted-foreground">{day.tasks.length} tareas planificadas</p>
          </div>
          {isOverloaded && <Badge variant="destructive">Sobrecarga</Badge>}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{minutesToHoursLabel(day.plannedMinutes)}</span>
            <span>{minutesToHoursLabel(day.capacityMinutes)}</span>
          </div>
          <Progress value={Math.min(progressValue, 100)} className={isOverloaded ? 'bg-red-100' : undefined} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {day.tasks.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Sin tareas en este rango.
          </div>
        ) : (
          day.tasks.map((task) => (
            <PlanningTaskCard
              key={task.id}
              task={task}
              cleaners={cleaners}
              onAssign={onAssign}
              onUnassign={onUnassign}
              isAssigning={isAssigning}
              compact
            />
          ))
        )}
      </CardContent>
    </Card>
  );
};
