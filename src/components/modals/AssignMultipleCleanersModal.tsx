import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Star, User, Users, X, Plus, Minus } from 'lucide-react';
import { Task } from '@/types/calendar';
import { TaskAssignment } from '@/types/taskAssignments';
import { useToast } from '@/hooks/use-toast';
import { useCleaners } from '@/hooks/useCleaners';
import { multipleTaskAssignmentService } from '@/services/storage/multipleTaskAssignmentService';
import { usePreferredCleanersByPropertyName } from '@/hooks/usePropertyPreferredCleaners';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AssignMultipleCleanersModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignComplete: () => void;
}

const formatPerWorker = (task: Task | null, count: number): string | null => {
  if (!task || count <= 0) return null;
  const [sh, sm] = (task.startTime || '').split(':').map(Number);
  const [eh, em] = (task.endTime || '').split(':').map(Number);
  if ([sh, sm, eh, em].some((v) => Number.isNaN(v))) return null;
  let total = eh * 60 + em - (sh * 60 + sm);
  if (total <= 0) total += 24 * 60;
  const per = Math.max(15, Math.round(total / count));
  const h = Math.floor(per / 60);
  const m = per % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}min` : `${h}h`) : `${m}min`;
};

export const AssignMultipleCleanersModal = ({
  task,
  open,
  onOpenChange,
  onAssignComplete,
}: AssignMultipleCleanersModalProps) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [initial, setInitial] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const { toast } = useToast();
  const { cleaners, isLoading: isLoadingCleaners } = useCleaners();
  const queryClient = useQueryClient();
  const { data: preferredData = [] } = usePreferredCleanersByPropertyName(task?.property);

  const preferredIds = useMemo(
    () => new Set(preferredData.map((p) => p.cleaner_id)),
    [preferredData]
  );
  const preferredNotesMap = useMemo(
    () => new Map(preferredData.map((p) => [p.cleaner_id, p.notes])),
    [preferredData]
  );

  useEffect(() => {
    const load = async () => {
      if (!task || !open) return;
      setLoadingAssignments(true);
      try {
        const current = await multipleTaskAssignmentService.getTaskAssignments(
          task.originalTaskId || task.id
        );
        const ids = current.map((a: TaskAssignment) => a.cleaner_id);
        setInitial(ids);
        setSelected(ids);
      } catch (e) {
        console.error('Error loading current assignments:', e);
      } finally {
        setLoadingAssignments(false);
      }
    };
    if (open) load();
    else {
      setSelected([]);
      setInitial([]);
    }
  }, [task, open]);

  const activeCleaners = useMemo(
    () => cleaners.filter((c) => c.isActive),
    [cleaners]
  );
  const cleanerById = useMemo(
    () => new Map(activeCleaners.map((c) => [c.id, c])),
    [activeCleaners]
  );

  const preferredCleaners = activeCleaners.filter((c) => preferredIds.has(c.id));
  const otherCleaners = activeCleaners.filter((c) => !preferredIds.has(c.id));

  const initialSet = useMemo(() => new Set(initial), [initial]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const added = selected.filter((id) => !initialSet.has(id));
  const removed = initial.filter((id) => !selectedSet.has(id));
  const hasChanges = added.length > 0 || removed.length > 0;
  const perWorkerLabel = formatPerWorker(task, selected.length);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSave = async () => {
    if (!task || !hasChanges) return;
    setIsLoading(true);
    try {
      const result = await multipleTaskAssignmentService.setTaskAssignments(
        task.originalTaskId || task.id,
        selected
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['taskAssignmentsForCalendar'] }),
      ]);
      queryClient.refetchQueries({ queryKey: ['tasks'] });
      queryClient.refetchQueries({ queryKey: ['taskAssignmentsForCalendar'] });

      const parts: string[] = [];
      if (result.added.length) parts.push(`+${result.added.map((c) => c.name).join(', ')}`);
      if (result.removed.length) parts.push(`−${result.removed.map((c) => c.name).join(', ')}`);

      toast({
        title:
          selected.length === 0
            ? 'Asignaciones vaciadas'
            : `${selected.length} trabajador(es) asignado(s)`,
        description: parts.join('  ·  ') || undefined,
      });

      onAssignComplete();
      onOpenChange(false);
    } catch (e) {
      console.error('Error setting assignments:', e);
      toast({
        title: 'Error',
        description: 'No se pudieron guardar las asignaciones. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!task) return null;

  const renderCleanerRow = (cleaner: { id: string; name: string }, preferred: boolean) => {
    const isSel = selectedSet.has(cleaner.id);
    const note = preferred ? preferredNotesMap.get(cleaner.id) : undefined;
    const wasInitial = initialSet.has(cleaner.id);
    const isAdded = isSel && !wasInitial;
    const isRemoved = !isSel && wasInitial;

    const row = (
      <div
        key={cleaner.id}
        onClick={() => toggle(cleaner.id)}
        className={[
          'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
          isAdded
            ? 'border-green-400 bg-green-50'
            : isRemoved
              ? 'border-red-300 bg-red-50/60'
              : isSel
                ? preferred
                  ? 'border-yellow-300 bg-yellow-50'
                  : 'border-blue-300 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white',
        ].join(' ')}
      >
        <Checkbox checked={isSel} onCheckedChange={() => toggle(cleaner.id)} />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {preferred ? (
            <Star className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
          ) : (
            <User className="h-4 w-4 text-gray-500 shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{cleaner.name}</span>
        </div>
        {isAdded && (
          <Badge className="bg-green-600 hover:bg-green-600 text-white text-[10px] px-1.5 py-0">
            <Plus className="h-3 w-3 mr-0.5" />
            nuevo
          </Badge>
        )}
        {isRemoved && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            <Minus className="h-3 w-3 mr-0.5" />
            quitar
          </Badge>
        )}
      </div>
    );

    if (!note) return row;
    return (
      <TooltipProvider key={cleaner.id}>
        <Tooltip>
          <TooltipTrigger asChild>{row}</TooltipTrigger>
          <TooltipContent>{note}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Asignar trabajadores
          </DialogTitle>
          <DialogDescription>
            {task.property} · {task.date} · {task.startTime}–{task.endTime}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Asignados actualmente */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Seleccionados
              </span>
              {perWorkerLabel && (
                <span className="text-xs text-muted-foreground">
                  ≈ {perWorkerLabel} por persona
                </span>
              )}
            </div>
            {loadingAssignments ? (
              <div className="text-sm text-muted-foreground">Cargando…</div>
            ) : selected.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">Sin asignar</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((id) => {
                  const c = cleanerById.get(id);
                  if (!c) return null;
                  const wasInitial = initialSet.has(id);
                  return (
                    <Badge
                      key={id}
                      variant="outline"
                      className={[
                        'gap-1 pl-2 pr-1 py-1 cursor-pointer',
                        wasInitial ? 'bg-background' : 'bg-green-100 border-green-300',
                      ].join(' ')}
                      onClick={() => toggle(id)}
                    >
                      {preferredIds.has(id) && (
                        <Star className="h-3 w-3 text-yellow-500" />
                      )}
                      {c.name}
                      <X className="h-3 w-3 opacity-60 hover:opacity-100" />
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selector */}
          <div>
            <label className="text-sm font-medium">Trabajadores disponibles</label>

            {isLoadingCleaners ? (
              <div className="text-center py-4 text-muted-foreground">Cargando…</div>
            ) : activeCleaners.length === 0 ? (
              <Alert className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>No hay trabajadores activos.</AlertDescription>
              </Alert>
            ) : (
              <div className="mt-2 space-y-3 max-h-[42vh] overflow-y-auto pr-1">
                {preferredCleaners.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 px-1 mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
                      <Star className="h-3 w-3 text-yellow-500" /> Preferidos
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {preferredCleaners.map((c) => renderCleanerRow(c, true))}
                    </div>
                  </div>
                )}
                {otherCleaners.length > 0 && (
                  <div>
                    {preferredCleaners.length > 0 && (
                      <div className="px-1 mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
                        Otros
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {otherCleaners.map((c) => renderCleanerRow(c, false))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Diff de cambios */}
          {hasChanges && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Cambios pendientes
              </div>
              {added.map((id) => {
                const c = cleanerById.get(id);
                return (
                  <div
                    key={`add-${id}`}
                    className="flex items-center gap-2 text-sm text-green-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{c?.name || id}</span>
                  </div>
                );
              })}
              {removed.map((id) => {
                const c = cleanerById.get(id);
                return (
                  <div
                    key={`rm-${id}`}
                    className="flex items-center gap-2 text-sm text-red-700"
                  >
                    <Minus className="h-3.5 w-3.5" />
                    <span>{c?.name || id}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !hasChanges}>
            {isLoading
              ? 'Guardando…'
              : !hasChanges
                ? 'Sin cambios'
                : selected.length === 0
                  ? 'Vaciar asignaciones'
                  : `Guardar ${added.length + removed.length} cambio${
                      added.length + removed.length === 1 ? '' : 's'
                    }`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
