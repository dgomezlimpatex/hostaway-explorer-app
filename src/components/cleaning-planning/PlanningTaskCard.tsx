import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Cleaner } from '@/types/calendar';
import { CleaningPlanningTask, PlanningTaskRisk } from '@/types/cleaningPlanning';
import { isOperationalCleaner, minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { AlertTriangle, Clock, Home, MapPin, UserX } from 'lucide-react';

interface PlanningTaskCardProps {
  task: CleaningPlanningTask;
  cleaners: Cleaner[];
  onAssign: (taskId: string, cleaner: Cleaner) => void;
  onUnassign?: (taskId: string) => void;
  isAssigning?: boolean;
  compact?: boolean;
}

const riskLabel: Record<PlanningTaskRisk, string> = {
  unassigned: 'Sin asignar',
  overlap: 'Solape',
  overcapacity: 'Sobrecarga',
  'missing-time': 'Horario incompleto',
  'missing-building': 'Edificio sin detectar',
  'ambiguous-building': 'Edificio ambiguo',
  'missing-duration': 'Duración pendiente',
  'no-real-availability': 'Sin disponibilidad real',
  'no-preferred-worker': 'Sin equipo preferente',
  'proposal-conflict': 'Conflicto propuesta',
};

const riskClass: Record<PlanningTaskRisk, string> = {
  unassigned: 'border-amber-300 bg-amber-50 text-amber-800',
  overlap: 'border-red-300 bg-red-50 text-red-800',
  overcapacity: 'border-red-300 bg-red-50 text-red-800',
  'missing-time': 'border-orange-300 bg-orange-50 text-orange-800',
  'missing-building': 'border-purple-300 bg-purple-50 text-purple-800',
  'ambiguous-building': 'border-purple-300 bg-purple-50 text-purple-800',
  'missing-duration': 'border-orange-300 bg-orange-50 text-orange-800',
  'no-real-availability': 'border-amber-300 bg-amber-50 text-amber-800',
  'no-preferred-worker': 'border-slate-300 bg-slate-50 text-slate-800',
  'proposal-conflict': 'border-red-300 bg-red-50 text-red-800',
};

export const PlanningTaskCard = ({ task, cleaners, onAssign, onUnassign, isAssigning, compact = false }: PlanningTaskCardProps) => {
  const [selectedCleanerId, setSelectedCleanerId] = useState(task.cleanerId || '');
  const operationalCleaners = useMemo(() => cleaners.filter(isOperationalCleaner), [cleaners]);
  const selectedCleaner = operationalCleaners.find((cleaner) => cleaner.id === selectedCleanerId);
  const taskId = task.originalTaskId || task.id;

  useEffect(() => {
    setSelectedCleanerId(task.cleanerId || '');
  }, [task.cleanerId]);

  const handleAssign = () => {
    if (!selectedCleaner) return;
    const message = task.cleanerId && selectedCleaner.id !== task.cleanerId
      ? `¿Reasignar "${task.property}" a ${selectedCleaner.name}?`
      : `¿Asignar "${task.property}" a ${selectedCleaner.name}?`;
    const confirmed = window.confirm(message);
    if (!confirmed) return;
    onAssign(taskId, selectedCleaner);
  };

  const handleUnassign = () => {
    if (!onUnassign) return;
    const confirmed = window.confirm(`¿Quitar la asignación de "${task.property}"?`);
    if (!confirmed) return;
    onUnassign(taskId);
  };

  return (
    <Card className="border-l-4 border-l-[#310984] bg-white shadow-sm">
      <CardContent className={compact ? 'space-y-2 p-3' : 'space-y-3 p-4'}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 shrink-0 text-[#310984]" />
              <h4 className="truncate font-semibold text-gray-900">{task.property}</h4>
            </div>
            {!compact && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{task.address}</span>
              </div>
            )}
          </div>
          <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>{task.displayStatus}</Badge>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-700">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{task.date}</span>
          <span>{task.displayStartTime}–{task.displayEndTime}</span>
          <span>{task.displayType}</span>
          <span>{minutesToHoursLabel(task.durationMinutes)}</span>
          <Badge variant="outline" className="text-[10px]">{task.zone}</Badge>
        </div>

        {task.riskFlags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.riskFlags.map((risk) => (
              <Badge key={risk} variant="outline" className={riskClass[risk]}>
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
            {operationalCleaners.map((cleaner) => (
              <option key={cleaner.id} value={cleaner.id}>{cleaner.name}</option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!selectedCleaner || isAssigning || selectedCleanerId === task.cleanerId}
            onClick={handleAssign}
          >
            {task.cleanerId ? 'Reasignar' : 'Asignar'}
          </Button>
          {task.cleanerId && onUnassign && (
            <Button size="sm" variant="outline" disabled={isAssigning} onClick={handleUnassign} title="Desasignar">
              <UserX className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
