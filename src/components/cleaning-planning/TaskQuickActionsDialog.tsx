import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCleaningPlanningActions } from '@/hooks/useCleaningPlanningActions';
import { Cleaner, Task } from '@/types/calendar';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';

/** Ajuste rápido sobre una limpieza ya asignada: hora, responsable o dejarla sin cubrir. */
export interface TaskQuickActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  cleaners: Cleaner[];
  /** Trabajadoras con otra limpieza que se pisa en el mismo tramo horario. */
  busyCleanerIds?: Set<string>;
  /** Trabajadoras con disponibilidad registrada ese día. */
  availableCleanerIds?: Set<string>;
  /** Hay una propuesta de reparto abierta, que quedará desactualizada al guardar aquí. */
  hasOpenProposal?: boolean;
  /** Se llama con el id de la tarea cuando el cambio ya está guardado. */
  onSaved?: (taskId: string) => void;
  /** Desasigna solo en el borrador cuando el tablero ofrece guardado final. */
  onUnassignDraft?: (taskId: string) => void;
}

const SNAP_MINUTES = 15;
const DEFAULT_START = '09:00';
const DEFAULT_DURATION_MINUTES = 60;
const NO_CLEANER_VALUE = '__planning_no_cleaner__';

const toMinutes = (value?: string | null): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const fromMinutes = (value: number): string => {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(value)));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

const normalizeStart = (value?: string | null): string => {
  const minutes = toMinutes(value);
  if (minutes === null) return DEFAULT_START;
  return fromMinutes(Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES);
};

const durationMinutesOf = (task: Task | null): number => {
  if (!task) return DEFAULT_DURATION_MINUTES;
  const start = toMinutes(task.startTime);
  const end = toMinutes(task.endTime);
  if (start === null || end === null || end - start <= 0) return DEFAULT_DURATION_MINUTES;
  return end - start;
};

export const TaskQuickActionsDialog = ({
  open,
  onOpenChange,
  task,
  cleaners,
  busyCleanerIds,
  availableCleanerIds,
  hasOpenProposal = false,
  onSaved,
  onUnassignDraft,
}: TaskQuickActionsDialogProps) => {
  const { updateTaskSchedule, reassignTask, unassignTaskAsync, isSavingQuickAction } = useCleaningPlanningActions();
  const currentCleanerId = (task?.cleanerId || '').trim();
  const durationMinutes = durationMinutesOf(task);
  const [startTime, setStartTime] = useState(() => normalizeStart(task?.startTime));
  const [cleanerId, setCleanerId] = useState(currentCleanerId);
  const [isUnassigning, setIsUnassigning] = useState(false);
  const unassignInFlightRef = useRef(false);
  const savingQuickAction = isSavingQuickAction || isUnassigning;

  useEffect(() => {
    if (!open) return;
    setStartTime(normalizeStart(task?.startTime));
    setCleanerId((task?.cleanerId || '').trim());
  }, [open, task?.id, task?.startTime, task?.cleanerId]);

  const selectableCleaners = useMemo(
    () => cleaners.filter((cleaner) => cleaner.isActive),
    [cleaners],
  );
  const currentCleaner = useMemo(
    () => selectableCleaners.find((cleaner) => cleaner.id === currentCleanerId),
    [currentCleanerId, selectableCleaners],
  );
  const currentCleanerLabel = currentCleaner?.name || task?.cleaner || 'Sin asignar';
  const coworkerCount = useMemo(() => {
    const assigned = Array.from(new Set(
      ((task?.assignments || [])
        .map((assignment) => assignment.cleaner_id)
        .filter((id): id is string => Boolean(id))),
    ));
    const ids = assigned.length > 0 ? assigned : (currentCleanerId ? [currentCleanerId] : []);
    return ids.filter((id) => id !== currentCleanerId).length;
  }, [currentCleanerId, task?.assignments]);

  const endTime = fromMinutes((toMinutes(startTime) ?? toMinutes(DEFAULT_START)!) + durationMinutes);
  const scheduleChanged = normalizeStart(task?.startTime) !== startTime;
  const cleanerChanged = Boolean(cleanerId) && cleanerId !== currentCleanerId;
  const hasChanges = scheduleChanged || cleanerChanged;
  const selectedCleaner = selectableCleaners.find((cleaner) => cleaner.id === cleanerId);

  if (!task) return null;

  const handleSave = async () => {
    if (!hasChanges || savingQuickAction || unassignInFlightRef.current) return;
    try {
      if (cleanerChanged && selectedCleaner) {
        await reassignTask({
          task,
          cleaner: selectedCleaner,
          previousCleanerId: currentCleanerId || undefined,
          startTime,
          endTime,
        });
      } else {
        await updateTaskSchedule({ task, startTime, endTime });
      }
      onSaved?.(task.id);
      onOpenChange(false);
    } catch {
      // El aviso de error ya lo muestra el hook; mantenemos la ventana abierta.
    }
  };

  const handleUnassign = async () => {
    if (savingQuickAction || unassignInFlightRef.current) return;
    if (onUnassignDraft) {
      onUnassignDraft(task.id);
      onOpenChange(false);
      return;
    }
    unassignInFlightRef.current = true;
    setIsUnassigning(true);
    try {
      await unassignTaskAsync(task);
      onSaved?.(task.id);
      onOpenChange(false);
    } catch {
      // El aviso de error ya lo muestra el hook; mantenemos la ventana abierta.
    } finally {
      unassignInFlightRef.current = false;
      setIsUnassigning(false);
    }
  };

  const cleanerHint = (cleaner: Cleaner): string => {
    const notes: string[] = [];
    if (cleaner.id === currentCleanerId) notes.push('asignada ahora');
    if (busyCleanerIds?.has(cleaner.id) && cleaner.id !== currentCleanerId) notes.push('ya tiene otra limpieza a esa hora');
    if (availableCleanerIds && !availableCleanerIds.has(cleaner.id)) notes.push('sin disponibilidad registrada');
    return notes.length > 0 ? ` (${notes.join(' · ')})` : '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6 text-left">{task.property}</DialogTitle>
          <DialogDescription className="text-left">
            {task.date}
            {task.address ? ` · ${task.address}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {normalizeStart(task.startTime)}–{fromMinutes((toMinutes(task.startTime) ?? toMinutes(DEFAULT_START)!) + durationMinutes)}
              <span className="text-muted-foreground">({minutesToHoursLabel(durationMinutes)})</span>
            </p>
            <p className="mt-1 text-muted-foreground">Responsable actual: {currentCleanerLabel}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="quick-action-start" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Hora de inicio
              </label>
              <input
                id="quick-action-start"
                type="time"
                step={SNAP_MINUTES * 60}
                value={startTime}
                disabled={savingQuickAction}
                onChange={(event) => setStartTime(normalizeStart(event.target.value))}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">Termina a las {endTime} (misma duración).</p>
            </div>

            <div className="space-y-1">
              <label htmlFor="quick-action-cleaner" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Asignar a
              </label>
              <Select
                value={cleanerId || NO_CLEANER_VALUE}
                disabled={savingQuickAction}
                onValueChange={(value) => setCleanerId(value === NO_CLEANER_VALUE ? '' : value)}
              >
                <SelectTrigger
                  id="quick-action-cleaner"
                  className="min-h-[44px] w-full transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none"
                  aria-label="Asignar responsable"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="planner-worker-select-content">
                  {!currentCleanerId && <SelectItem value={NO_CLEANER_VALUE}>Sin responsable</SelectItem>}
                  {currentCleanerId && !currentCleaner && (
                    <SelectItem value={currentCleanerId}>{currentCleanerLabel} (asignada ahora)</SelectItem>
                  )}
                  {selectableCleaners.map((cleaner) => (
                    <SelectItem
                      key={cleaner.id}
                      value={cleaner.id}
                      className="min-h-[40px] transition-[background-color,color] duration-150 data-[highlighted]:bg-brand/10 data-[highlighted]:text-brand data-[state=checked]:bg-brand/10 data-[state=checked]:text-brand motion-reduce:transition-none"
                    >
                      {cleaner.name}{cleanerHint(cleaner)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                La disponibilidad y los solapes son avisos; puedes asignar igualmente.
                {coworkerCount > 0
                  ? ` Esta limpieza tiene ${coworkerCount + 1} trabajadoras: se cambia solo a la elegida y se mantienen las demás.`
                  : ''}
              </p>
            </div>
          </div>

          <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            {onUnassignDraft
              ? 'Desasignar deja el cambio pendiente hasta guardar el reparto. Los cambios de esta ventana en hora o responsable se guardan al momento.'
              : 'Se guarda al momento sobre la tarea.'}
            {hasOpenProposal
              ? ' El reparto abierto se revisará con los nuevos datos; los cambios externos pueden requerir volver a planificar.'
              : ''}
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            aria-busy={savingQuickAction}
            className="min-h-[44px] gap-2"
            disabled={savingQuickAction}
            onClick={handleUnassign}
          >
            <UserX className="h-4 w-4" />
            {isUnassigning ? 'Desasignando…' : 'Desasignar la tarea'}
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              className="min-h-[44px]"
              disabled={savingQuickAction}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              aria-busy={savingQuickAction}
              className="relative isolate min-h-[44px] overflow-hidden bg-ink text-white hover:bg-black"
              disabled={!hasChanges || savingQuickAction}
              onClick={handleSave}
            >
              {savingQuickAction && <span aria-hidden="true" className="planner-save-progress absolute inset-0 bg-white/20" />}
              <span className="relative z-10">{savingQuickAction ? 'Guardando…' : 'Guardar cambios'}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
