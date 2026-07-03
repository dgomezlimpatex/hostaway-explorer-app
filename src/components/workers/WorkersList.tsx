import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { GripVertical, Mail, Phone, User, UserCheck, UserX } from 'lucide-react';
import { Cleaner } from '@/types/calendar';
import { useDeleteCleaner, useUpdateCleaner, useUpdateCleanersOrder } from '@/hooks/useCleaners';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
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
import { DeactivateWorkerDialog } from './DeactivateWorkerDialog';

interface WorkersListProps {
  workers: Cleaner[];
  isLoading: boolean;
  selectedWorkerId?: string | null;
  onViewWorker: (worker: Cleaner) => void;
}

const initialsFor = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();

export const WorkersList = ({ workers, isLoading, selectedWorkerId, onViewWorker }: WorkersListProps) => {
  const [localWorkers, setLocalWorkers] = useState<Cleaner[]>(workers);
  const [workerToDeactivate, setWorkerToDeactivate] = useState<Cleaner | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const isMobile = useIsMobile();

  const deleteCleaner = useDeleteCleaner();
  const updateCleaner = useUpdateCleaner();
  const updateCleanersOrder = useUpdateCleanersOrder();

  React.useEffect(() => {
    setLocalWorkers(workers);
  }, [workers]);

  const handleDelete = (workerId: string) => {
    deleteCleaner.mutate(workerId);
  };

  const handleToggleActive = (worker: Cleaner) => {
    if (worker.isActive) {
      setWorkerToDeactivate(worker);
      return;
    }

    updateCleaner.mutate({
      id: worker.id,
      updates: { isActive: true },
    });
  };

  const handleDragStart = (event: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (event: React.DragEvent, dropIndex: number) => {
    event.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newWorkers = [...localWorkers];
    const draggedWorker = newWorkers[draggedIndex];
    newWorkers.splice(draggedIndex, 1);
    newWorkers.splice(dropIndex, 0, draggedWorker);

    setLocalWorkers(newWorkers);
    setDraggedIndex(null);

    const orderUpdates = newWorkers.map((worker, index) => ({
      id: worker.id,
      sortOrder: index,
    }));

    updateCleanersOrder.mutate(orderUpdates);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const deactivateDialog = (
    <DeactivateWorkerDialog
      worker={workerToDeactivate}
      open={!!workerToDeactivate}
      onOpenChange={(open) => {
        if (!open) setWorkerToDeactivate(null);
      }}
    />
  );

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        <p className="mt-2 text-muted-foreground">Cargando trabajadores...</p>
      </div>
    );
  }

  if (localWorkers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-white py-8 text-center">
        <User className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-medium text-foreground">No hay trabajadores</h3>
        <p className="mt-1 text-sm text-muted-foreground">Prueba con otro filtro o crea un trabajador nuevo.</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <>
        <div className="space-y-2.5">
          {localWorkers.map((worker) => (
            <Card
              key={worker.id}
              className={cn(
                'overflow-hidden border-0 bg-white shadow-sm ring-offset-2 transition',
                selectedWorkerId === worker.id && 'ring-2 ring-[#310984]',
                !worker.isActive && 'bg-slate-100/80'
              )}
            >
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => onViewWorker(worker)}
                  className="flex w-full items-start gap-3 p-3 text-left"
                >
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={worker.avatar || undefined} />
                    <AvatarFallback className="bg-blue-100 text-xs font-semibold text-blue-700">
                      {initialsFor(worker.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-950">{worker.name}</p>
                        {worker.category && (
                          <p className="truncate text-xs text-muted-foreground">{worker.category}</p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'shrink-0 border-0 text-[10px]',
                          worker.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        )}
                      >
                        {worker.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      {worker.telefono && (
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{worker.telefono}</span>
                        </p>
                      )}
                      {worker.email && (
                        <p className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{worker.email}</span>
                        </p>
                      )}
                      {worker.externalId && (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          REGISTRO
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-2 border-t border-slate-100 p-2">
                  {worker.isActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 flex-1 rounded-lg border-amber-200 text-xs text-amber-700"
                      onClick={() => handleToggleActive(worker)}
                    >
                      <UserX className="mr-1 h-3.5 w-3.5" />
                      Desactivar
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 flex-1 rounded-lg border-emerald-200 text-xs text-emerald-700"
                      onClick={() => handleToggleActive(worker)}
                    >
                      <UserCheck className="mr-1 h-3.5 w-3.5" />
                      Reactivar
                    </Button>
                  )}
                  {!worker.externalId && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-9 rounded-lg px-2 text-xs text-destructive">
                          Eliminar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar trabajador</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente el trabajador
                            "{worker.name}" y todas sus tareas asignadas quedaran sin asignar.
                            <br />
                            <br />
                            Si solo quieres que deje de aparecer en las asignaciones, usa "Desactivar" en su lugar.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(worker.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Eliminar definitivamente
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {deactivateDialog}
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {localWorkers.map((worker, index) => {
          const isSelected = selectedWorkerId === worker.id;

          return (
            <div
              key={worker.id}
              onDragOver={handleDragOver}
              onDrop={(event) => handleDrop(event, index)}
              className={cn(
                'flex w-full items-center gap-2 rounded-2xl border bg-white p-2 shadow-sm transition',
                isSelected && 'border-[#310984]/30 bg-violet-50 shadow-md ring-1 ring-[#310984]/20',
                !isSelected && 'border-slate-200 hover:border-[#310984]/25 hover:bg-slate-50',
                draggedIndex === index && 'opacity-50',
                !worker.isActive && 'opacity-70'
              )}
            >
              <button
                type="button"
                draggable
                onDragStart={(event) => handleDragStart(event, index)}
                onDragEnd={handleDragEnd}
                onClick={(event) => event.stopPropagation()}
                className="flex h-10 w-7 shrink-0 cursor-grab items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
                title="Arrastrar para ordenar"
                aria-label={`Mover ${worker.name}`}
              >
                <GripVertical className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => onViewWorker(worker)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#310984]"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={worker.avatar || undefined} />
                  <AvatarFallback className="bg-slate-100 text-xs font-black text-slate-700">
                    {initialsFor(worker.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className={cn('line-clamp-2 text-sm font-black leading-tight text-slate-950', !worker.isActive && 'text-slate-500')}>
                    {worker.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {worker.category && (
                      <span className="truncate text-xs text-slate-500">{worker.category}</span>
                    )}
                    {worker.externalId && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                        REGISTRO
                      </span>
                    )}
                    {!worker.isActive && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600">
                        INACTIVA
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
      {deactivateDialog}
    </>
  );
};
