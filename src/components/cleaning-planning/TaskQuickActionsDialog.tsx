import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}

const SNAP_MINUTES = 15;
const DEFAULT_START = '09:00';
const DEFAULT_DURATION_MINUTES = 60;

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
}: TaskQuickActionsDialogProps) => {
  const { updateTaskSchedule, reassignTask, unassignTaskAsync, isSavingQuickAction } = useCleaningPlanningActions();
  const currentCleanerId = (task?.cleanerId || '').trim();
  const durationMinutes = durationMinutesOf(task);
  const [startTime, setStartTime] = useState(() => normalizeStart(task?.startTime));
  const [cleanerId, setCleanerId] = useState(currentCleanerId);
  const [confirmingUnassign, setConfirmingUnassign] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStartTime(normalizeStart(task?.startTime));
    setCleanerId((task?.cleanerId || '').trim());
    setConfirmingUnassign(false);
  }, [open, task?.id, task?.startTime, task?.cleanerId]);

  const selectableCleaners = useMemo(
    () => cleaners.filter((cleaner) => cleaner.isActive),
    [cleaners],
  );
  const currentCleaner = useMemo(
    () => selectableCleaners.find((cleaner) => cleaner.id === currentCleanerId),
    [currentCleanerId, selectableCleaners],
  );
  const currentCleanerLabel = currentCleaner?.name || task?.cleaner || 'Sin responsable';

  const endTime = fromMinutes((toMinutes(startTime) ?? toMinutes(DEFAULT_START)!) + durationMinutes);
  const scheduleChanged = normalizeStart(task?.startTime) !== startTime;
  const cleanerChanged = Boolean(cleanerId) && cleanerId !== currentCleanerId;
  const hasChanges = scheduleChanged || cleanerChanged;
  const selectedCleaner = selectableCleaners.find((cleaner) => cleaner.id === cleanerId);

  if (!task) return null;

  const handleSave = async () => {
    if (!hasChanges || isSavingQuickAction) return;
    try {
      if (cleanerChanged && selectedCleaner) {
        await reassignTask({
          task,
          cleaner: selectedCleaner,
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
    if (isSavingQuickAction) return;
    if (!confirmingUnassign) {
      setConfirmingUnassign(true);
      return;
    }
    try {
      await unassignTaskAsync(task);
      onSaved?.(task.id);
      onOpenChange(false);
    } catch {
      // El aviso de error ya lo muestra el hook; mantenemos la ventana abierta.
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
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
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
                disabled={isSavingQuickAction}
                onChange={(event) => setStartTime(normalizeStart(event.target.value))}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">Termina a las {endTime} (misma duración).</p>
            </div>

            <div className="space-y-1">
              <label htmlFor="quick-action-cleaner" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Asignar a
              </label>
              <select
                id="quick-action-cleaner"
                value={cleanerId}
                disabled={isSavingQuickAction}
                onChange={(event) => setCleanerId(event.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {!currentCleanerId && <option value="">Sin responsable</option>}
                {currentCleanerId && !currentCleaner && (
                  <option value={currentCleanerId}>{currentCleanerLabel} (asignada ahora)</option>
                )}
                {selectableCleaners.map((cleaner) => (
                  <option key={cleaner.id} value={cleaner.id}>
                    {cleaner.name}{cleanerHint(cleaner)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                La disponibilidad y los solapes son avisos; puedes asignar igualmente.
              </p>
            </div>
          </div>

          {confirmingUnassign && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                ¿Quitar la asignación a <strong>{currentCleanerLabel}</strong>? La limpieza quedará
                sin responsable y aparecerá en la bandeja de «Sin cubrir» de la planificación.
              </p>
            </div>
          )}

          <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            Se guarda al momento sobre la tarea.
            {hasOpenProposal
              ? ' Tienes una propuesta de reparto abierta: quedará marcada como desactualizada y habrá que regenerarla.'
              : ''}
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant={confirmingUnassign ? 'destructive' : 'outline'}
            className="min-h-[44px] gap-2"
            disabled={isSavingQuickAction}
            onClick={handleUnassign}
          >
            <UserX className="h-4 w-4" />
            {confirmingUnassign ? 'Sí, quitar asignación' : 'Desasignar la tarea'}
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              className="min-h-[44px]"
              disabled={isSavingQuickAction}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="min-h-[44px] bg-[#310984] text-white hover:bg-[#26066a]"
              disabled={!hasChanges || isSavingQuickAction}
              onClick={handleSave}
            >
              {isSavingQuickAction ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
