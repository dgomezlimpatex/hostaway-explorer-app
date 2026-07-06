import { useEffect, useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Cleaner } from '@/types/calendar';
import { CleaningPlanningTask, PlanningTaskRisk } from '@/types/cleaningPlanning';
import { isOperationalCleaner, minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { AlertTriangle, Clock, ExternalLink, Home, MapPin, UserX } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PlanningTaskCardProps {
  task: CleaningPlanningTask;
  cleaners: Cleaner[];
  onAssign: (taskId: string, cleaner: Cleaner) => void;
  onUnassign?: (taskId: string) => void;
  isAssigning?: boolean;
  compact?: boolean;
  variant?: 'simple' | 'detailed';
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
  unassigned: 'border-amber-300/40 bg-amber-400/10 text-amber-100',
  overlap: 'border-red-300/40 bg-red-400/10 text-red-100',
  overcapacity: 'border-red-300/40 bg-red-400/10 text-red-100',
  'missing-time': 'border-orange-300/40 bg-orange-400/10 text-orange-100',
  'missing-building': 'border-purple-300/40 bg-purple-400/10 text-purple-100',
  'ambiguous-building': 'border-purple-300/40 bg-purple-400/10 text-purple-100',
  'missing-duration': 'border-orange-300/40 bg-orange-400/10 text-orange-100',
  'no-real-availability': 'border-amber-300/40 bg-amber-400/10 text-amber-100',
  'no-preferred-worker': 'border-slate-300/40 bg-slate-400/10 text-slate-100',
  'proposal-conflict': 'border-red-300/40 bg-red-400/10 text-red-100',
};

export const PlanningTaskCard = ({ task, cleaners, onAssign, onUnassign, isAssigning, compact = false, variant = 'detailed' }: PlanningTaskCardProps) => {
  const [selectedCleanerId, setSelectedCleanerId] = useState(task.cleanerId || '');
  const operationalCleaners = useMemo(() => cleaners.filter(isOperationalCleaner), [cleaners]);
  const selectedCleaner = operationalCleaners.find((cleaner) => cleaner.id === selectedCleanerId);
  const taskId = task.originalTaskId || task.id;
  const isReassignment = Boolean(task.cleanerId && selectedCleaner && selectedCleaner.id !== task.cleanerId);
  const canAssignSelected = Boolean(selectedCleaner && !isAssigning && selectedCleanerId !== task.cleanerId);
  const isSimple = variant === 'simple';

  useEffect(() => {
    setSelectedCleanerId(task.cleanerId || '');
  }, [task.cleanerId]);

  const handleAssignConfirmed = () => {
    if (!selectedCleaner) return;
    onAssign(taskId, selectedCleaner);
  };

  const handleUnassignConfirmed = () => {
    if (!onUnassign) return;
    onUnassign(taskId);
  };

  return (
    <Card className={isSimple ? 'border-l-4 border-l-[#310984] border-[#310984]/10 bg-white text-[#171321] shadow-sm shadow-[#310984]/5' : 'border-l-4 border-l-[#8b5cf6] border-white/10 bg-white/[0.06] text-white shadow-sm shadow-black/20'}>
      <CardContent className={compact ? 'space-y-2 p-3' : 'space-y-3 p-4'}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Home className={isSimple ? 'h-4 w-4 shrink-0 text-[#310984]' : 'h-4 w-4 shrink-0 text-[#c7b8ff]'} />
              <h4 className={isSimple ? 'break-words font-semibold text-[#171321]' : 'break-words font-semibold text-white'}>{task.property}</h4>
            </div>
            {!compact && !isSimple && (
              <div className="mt-1 flex items-center gap-1 text-xs text-white/55">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="min-w-0 break-words">{task.address}</span>
              </div>
            )}
          </div>
          <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>{task.displayStatus}</Badge>
        </div>

        <div className={isSimple ? 'flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6b627a]' : 'flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/70'}>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{task.date}</span>
          <span>{task.displayStartTime}–{task.displayEndTime}</span>
          <span>{task.displayType}</span>
          <span>{minutesToHoursLabel(task.durationMinutes)}</span>
          {!isSimple && <Badge variant="outline" className="border-white/15 bg-white/5 text-[10px] text-white/70">{task.zone}</Badge>}
        </div>

        {task.riskFlags.length > 0 && !isSimple && (
          <div className="flex flex-wrap gap-1">
            {task.riskFlags.map((risk) => (
              <Badge key={risk} variant="outline" className={riskClass[risk]}>
                <AlertTriangle className="mr-1 h-3 w-3" />{riskLabel[risk]}
              </Badge>
            ))}
          </div>
        )}

        {task.detectedBuilding?.propertyGroupId && !isSimple && (
          <Button asChild size="sm" variant="outline" className="min-h-[36px] w-fit border-white/15 bg-white/5 text-xs text-white hover:bg-white/10 hover:text-white">
            <Link to={`/planning/buildings/${task.detectedBuilding.propertyGroupId}`}>
              Ver ficha edificio
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        )}

        {isSimple && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className={task.cleanerId ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
              {task.cleaner || 'Sin responsable'}
            </Badge>
            {task.riskFlags.length > 0 && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                {task.riskFlags.length} revisión{task.riskFlags.length === 1 ? '' : 'es'}
              </Badge>
            )}
            {task.durationMinutes >= 240 && (
              <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
                Casa grande
              </Badge>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            aria-label={`Seleccionar limpiadora para ${task.property}`}
            className={isSimple ? 'h-11 min-h-[44px] flex-1 rounded-md border border-[#310984]/12 bg-white px-3 text-sm text-[#171321] outline-none ring-offset-white focus:border-[#310984]/50 focus:ring-2 focus:ring-[#310984]/15' : 'h-11 min-h-[44px] flex-1 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none ring-offset-[#08090a] focus:border-[#c7b8ff]/60 focus:ring-2 focus:ring-[#c7b8ff]/30'}
            value={selectedCleanerId}
            onChange={(event) => setSelectedCleanerId(event.target.value)}
          >
            <option value="">Seleccionar limpiadora…</option>
            {operationalCleaners.map((cleaner) => (
              <option key={cleaner.id} value={cleaner.id}>{cleaner.name}</option>
            ))}
          </select>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={!canAssignSelected} className="min-h-[44px] bg-[#310984] text-white hover:bg-[#4c1bb0]">
                {task.cleanerId ? 'Reasignar' : 'Asignar'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{isReassignment ? 'Confirmar reasignación' : 'Confirmar asignación'}</AlertDialogTitle>
                <AlertDialogDescription>
                  {isReassignment ? 'Vas a cambiar la responsable de esta tarea existente.' : 'Vas a asignar una responsable a esta tarea existente.'}
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-3 rounded-xl border bg-muted/30 p-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{task.property}</p>
                  <p className="text-muted-foreground">{task.date} · {task.displayStartTime}–{task.displayEndTime} · {minutesToHoursLabel(task.durationMinutes)}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border bg-background p-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Actual</p>
                    <p className="font-medium">{task.cleaner || 'Sin asignar'}</p>
                  </div>
                  <div className="rounded-lg border bg-background p-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Nueva</p>
                    <p className="font-medium">{selectedCleaner?.name || 'Sin seleccionar'}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  Disponibilidad real no validada en esta acción manual: revisa riesgos visibles, solapes y capacidad antes de confirmar. Esta acción puede disparar las notificaciones actuales del sistema.
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction disabled={!selectedCleaner || isAssigning} onClick={handleAssignConfirmed}>
                  Confirmar {isReassignment ? 'reasignación' : 'asignación'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {task.cleanerId && onUnassign && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  aria-label={`Desasignar ${task.property}`}
                  size="sm"
                  variant="outline"
                  disabled={isAssigning}
                  className={isSimple ? 'min-h-[44px] min-w-[44px] border-[#310984]/15 bg-white text-[#310984] hover:bg-[#f0eaff] hover:text-[#310984]' : 'min-h-[44px] min-w-[44px] border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white'}
                  title="Desasignar"
                >
                  <UserX className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Quitar asignación</AlertDialogTitle>
                  <AlertDialogDescription>
                    La tarea volverá a quedar sin responsable y deberá revisarse en la planificación.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                  <p className="font-medium text-foreground">{task.property}</p>
                  <p className="text-muted-foreground">{task.date} · {task.displayStartTime}–{task.displayEndTime}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Responsable actual: {task.cleaner || 'Sin asignar'}</p>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" disabled={isAssigning} onClick={handleUnassignConfirmed}>
                    Quitar asignación
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
