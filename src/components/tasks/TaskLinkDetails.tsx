import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Loader2, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { TaskDetailsModal } from '@/components/modals/TaskDetailsModal';
import { useSede } from '@/contexts/SedeContext';
import { taskStorageService } from '@/services/storage/taskStorage';
import { ENTITY_LINK_PARAM, resolveLinkedEntity, withoutSearchParam } from '@/components/navigation/entityLinks';
import { ENTITY_DETAIL_TITLE_ATTR, restoreFocusAfterLinkedDetail } from '@/components/navigation/useLinkedSelection';
import { useTaskActions } from './hooks/useTaskActions';

/**
 * Opens the existing task detail for `/tasks?taskId=<id>`. The task is read by id
 * within the active sede, so it opens even if the list (current week, filters,
 * pagination) does not include it. Closing removes the param from the URL.
 */
export function TaskLinkDetails() {
  const [params, setParams] = useSearchParams();
  const taskId = params.get(ENTITY_LINK_PARAM.task);
  const close = useCallback(() => {
    setParams((current) => withoutSearchParam(current, ENTITY_LINK_PARAM.task), { replace: true });
    restoreFocusAfterLinkedDetail();
  }, [setParams]);
  return taskId ? <LinkedTask taskId={taskId} onClose={close} /> : null;
}

function LinkedTask({ taskId, onClose: close }: { taskId: string; onClose: () => void }) {
  const { activeSede, isInitialized, loading } = useSede();
  const sedeId = activeSede?.id;
  const sedeReady = isInitialized && !loading && !!sedeId;
  const query = useQuery({
    queryKey: ['task-link', taskId, sedeId],
    queryFn: async () => (await taskStorageService.getById(taskId)) ?? null,
    enabled: sedeReady,
    retry: false,
  });
  const { handleUpdateTask, handleDeleteTask } = useTaskActions();

  const linked = resolveLinkedEntity(taskId, query.isSuccess ? (query.data ? [query.data] : []) : undefined, { ready: sedeReady, sedeId });

  if (linked.status === 'found') {
    return (
      <TaskDetailsModal
        key={linked.entity.id}
        task={linked.entity}
        open
        onOpenChange={(open) => { if (!open) close(); }}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
      />
    );
  }

  const failed = query.isError;
  const pending = !failed && linked.status === 'loading';
  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-md rounded-2xl">
        {pending ? (
          <>
            <DialogTitle className="sr-only">Abriendo tarea</DialogTitle>
            <DialogDescription className="sr-only">Cargando el detalle de la tarea seleccionada.</DialogDescription>
            <p role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Cargando tarea…
            </p>
          </>
        ) : (
          <div role="alert" className="flex flex-col items-center py-4 text-center">
            <SearchX className="h-10 w-10 text-slate-300" aria-hidden="true" />
            <DialogTitle tabIndex={-1} {...{ [ENTITY_DETAIL_TITLE_ATTR]: '' }} className="mt-3 focus:outline-none">
              {failed ? 'No se ha podido cargar la tarea' : 'Tarea no disponible'}
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-sm">
              {failed
                ? 'Comprueba la conexión y vuelve a intentarlo.'
                : 'No existe, se ha eliminado o no pertenece a la sede activa. No se ha abierto ninguna otra tarea.'}
            </DialogDescription>
            <div className="mt-4 flex gap-2">
              {failed && <Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button>}
              <Button onClick={close}>Volver a tareas</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
