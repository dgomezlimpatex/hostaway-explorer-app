import React from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Cleaner } from '@/types/calendar';
import {
  useDeactivateCleaner,
  useFuturePendingTasksForCleaner,
} from '@/hooks/useDeactivateCleaner';

interface DeactivateWorkerDialogProps {
  worker: Cleaner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

export const DeactivateWorkerDialog: React.FC<DeactivateWorkerDialogProps> = ({
  worker,
  open,
  onOpenChange,
  onDone,
}) => {
  const {
    data: futureTasks = [],
    isLoading: loadingTasks,
    isFetching,
    isError: previewFailed,
    error: previewError,
    refetch,
  } = useFuturePendingTasksForCleaner(
    open ? worker?.id ?? null : null,
  );
  const deactivate = useDeactivateCleaner();

  const handleConfirm = async () => {
    if (!worker || loadingTasks || previewFailed) return;
    await deactivate.mutateAsync({
      cleanerId: worker.id,
      unassignFutureTasks: true,
    });
    onOpenChange(false);
    onDone?.();
  };

  const count = futureTasks.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Desactivar a {worker?.name}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                El trabajador desaparecerá del calendario y de los selectores de asignación,
                pero se conservará su historial.
              </p>

              {worker?.externalId && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900 text-xs">
                  🔗 Este trabajador está vinculado a REGISTRO. Si en REGISTRO sigue activo,
                  la próxima sincronización podría reactivarlo. Para una baja definitiva, dale de baja en REGISTRO.
                </div>
              )}
              {loadingTasks ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Comprobando tareas pendientes...
                </div>
              ) : previewFailed ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-900">
                  <p className="font-medium">No se pudieron comprobar las tareas pendientes.</p>
                  <p className="mt-1 text-xs">
                    La baja está bloqueada para evitar que alguna tarea quede oculta. Reintenta la comprobación.
                  </p>
                  {previewError instanceof Error && (
                    <p className="mt-1 text-xs text-red-700">{previewError.message}</p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 border-red-200 bg-white"
                    onClick={() => refetch()}
                    disabled={isFetching}
                  >
                    {isFetching && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Volver a comprobar
                  </Button>
                </div>
              ) : count === 0 ? (
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-muted-foreground">
                    ✅ No tiene tareas futuras pendientes asignadas.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-yellow-900">
                      Tareas futuras pendientes
                    </span>
                    <Badge variant="secondary" className="bg-yellow-200 text-yellow-900">
                      {count}
                    </Badge>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {futureTasks.slice(0, 8).map((t) => (
                      <div
                        key={t.id}
                        className="text-xs text-yellow-900 flex items-center justify-between gap-2"
                      >
                        <span className="truncate">
                          {t.property || 'Tarea sin propiedad'}
                        </span>
                        <span className="whitespace-nowrap text-yellow-700">
                          {format(parseISO(t.date), "d MMM", { locale: es })}
                          {t.start_time ? ` · ${t.start_time.slice(0, 5)}` : ''}
                        </span>
                      </div>
                    ))}
                    {count > 8 && (
                      <p className="text-xs text-yellow-700 italic">
                        ...y {count - 8} más.
                      </p>
                    )}
                  </div>

                  <div className="border-t border-yellow-200 pt-2 text-sm text-yellow-900">
                    <strong>Al confirmar, estas {count} tarea{count === 1 ? '' : 's'} quedarán sin asignar</strong>{' '}
                    y volverán a estar visibles para reasignarlas manualmente o con Hermes.
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deactivate.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={deactivate.isPending || loadingTasks || previewFailed}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            {deactivate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Desactivando...
              </>
            ) : (
              'Desactivar'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
