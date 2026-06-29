import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Cleaner } from '@/types/calendar';
import { CleaningPlanningTask, PlanningTaskRisk } from '@/types/cleaningPlanning';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { AlertTriangle, Clock, Home, MapPin, UserX } from 'lucide-react';

interface PlanningTaskCardProps {
  task: CleaningPlanningTask;
  cleaners: Cleaner[];
  onAssign: (taskId: string, cleaner: Cleaner) => void;
  onUnassign?: (taskId: string) => void;
  isAssigning?: boolean;
}

const riskLabel: Record<PlanningTaskRisk, string> = {
  unassigned: 'Sin asignar',
  overlap: 'Solape',
  overcapacity: 'Sobrecarga',
  'missing-time': 'Horario incompleto',
};

export const PlanningTaskCard = ({ task, cleaners, onAssign, onUnassign, isAssigning }: PlanningTaskCardProps) => {
  const [selectedCleanerId, setSelectedCleanerId] = useState(task.cleanerId || '');
  const selectedCleaner = cleaners.find((cleaner) => cleaner.id === selectedCleanerId);

  return (
    <Card className="border-l-4 border-l-[#310984] bg-white shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-[#310984]" />
              <h4 className="truncate font-semibold text-gray-900">{task.property}</h4>
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{task.address}</span>
            </div>
          </div>
          <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>{task.status}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{task.date}</span>
          <span>{task.startTime}–{task.endTime}</span>
          <span>{task.type}</span>
          <span>{minutesToHoursLabel(task.durationMinutes)}</span>
        </div>

        {task.riskFlags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.riskFlags.map((risk) => (
              <Badge key={risk} variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                <AlertTriangle className="mr-1 h-3 w-3" />{riskLabel[risk]}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            value={selectedCleanerId}
            onChange={(event) => setSelectedCleanerId(event.target.value)}
          >
            <option value="">Seleccionar limpiadora…</option>
            {cleaners.filter((cleaner) => cleaner.isActive).map((cleaner) => (
              <option key={cleaner.id} value={cleaner.id}>{cleaner.name}</option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!selectedCleaner || isAssigning || selectedCleanerId === task.cleanerId}
            onClick={() => selectedCleaner && onAssign(task.originalTaskId || task.id, selectedCleaner)}
          >
            {task.cleanerId ? 'Reasignar' : 'Asignar'}
          </Button>
          {task.cleanerId && onUnassign && (
            <Button size="sm" variant="outline" disabled={isAssigning} onClick={() => onUnassign(task.originalTaskId || task.id)}>
              <UserX className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
