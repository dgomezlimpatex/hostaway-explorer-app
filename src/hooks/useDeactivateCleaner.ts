import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { rpcUntyped } from '@/lib/supabaseUntyped';
import { useCacheInvalidation } from './useCacheInvalidation';

export interface FuturePendingTask {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  property: string | null;
  status: string;
}

interface DeactivateCleanerResult {
  unassignedCount?: number;
  alreadyInactive?: boolean;
}

/**
 * Cuenta las tareas futuras pendientes desde la misma fuente canónica que usa
 * la baja atómica. Incluye task_assignments y compatibilidad legada.
 */
export const useFuturePendingTasksForCleaner = (cleanerId: string | null) => {
  return useQuery({
    queryKey: ['cleaner-future-pending-tasks', cleanerId],
    queryFn: async (): Promise<FuturePendingTask[]> => {
      if (!cleanerId) return [];
      const { data, error } = await rpcUntyped('get_future_pending_tasks_for_cleaner', {
        _cleaner_id: cleanerId,
      });
      if (error) throw error;
      return (data || []) as FuturePendingTask[];
    },
    enabled: !!cleanerId,
    staleTime: 30_000,
  });
};

/**
 * Desactiva al trabajador y, opcionalmente, retira sus tareas futuras dentro
 * de una única transacción PostgreSQL. La RPC conserva a los demás operarios
 * de tareas compartidas y encola las cancelaciones solo si todo el lote termina.
 */
export const useDeactivateCleaner = () => {
  const queryClient = useQueryClient();
  const { invalidateCleaners, invalidateTasks } = useCacheInvalidation();

  return useMutation({
    mutationFn: async ({
      cleanerId,
      unassignFutureTasks,
    }: {
      cleanerId: string;
      unassignFutureTasks: boolean;
    }) => {
      const { data, error } = await rpcUntyped('deactivate_cleaner_with_future_assignments', {
        _cleaner_id: cleanerId,
        _unassign_future_tasks: unassignFutureTasks,
      });
      if (error) {
        throw new Error(`No se pudo desactivar al trabajador: ${error.message}`);
      }

      const result = (data || {}) as DeactivateCleanerResult;
      return { unassignedCount: result.unassignedCount || 0 };
    },
    onSuccess: ({ unassignedCount }, variables) => {
      invalidateCleaners();
      if (variables.unassignFutureTasks) {
        invalidateTasks();
        queryClient.invalidateQueries({ queryKey: ['cleaner-future-pending-tasks'] });
      }
      toast({
        title: 'Trabajador desactivado',
        description: variables.unassignFutureTasks
          ? `Se han desasignado ${unassignedCount} tarea${unassignedCount === 1 ? '' : 's'} futura${unassignedCount === 1 ? '' : 's'}.`
          : 'El trabajador ha sido desactivado. Sus tareas asignadas se han mantenido.',
      });
    },
    onError: (error: unknown) => {
      const description = error instanceof Error
        ? error.message
        : 'No se pudo desactivar al trabajador.';
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    },
  });
};
