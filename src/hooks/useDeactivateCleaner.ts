import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useCacheInvalidation } from './useCacheInvalidation';

export interface FuturePendingTask {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  property: string | null;
  status: string;
}

/**
 * Cuenta tareas futuras (hoy o posterior) asignadas a un trabajador
 * que NO estén completadas o canceladas. Estas serían las que se desasignarían
 * si se desactiva al trabajador.
 */
export const useFuturePendingTasksForCleaner = (cleanerId: string | null, cleanerName?: string | null) => {
  return useQuery({
    queryKey: ['cleaner-future-pending-tasks', cleanerId, cleanerName],
    queryFn: async (): Promise<FuturePendingTask[]> => {
      if (!cleanerId) return [];
      const today = format(new Date(), 'yyyy-MM-dd');

      // Tareas asignadas por cleaner_id
      const { data: byId, error: errId } = await supabase
        .from('tasks')
        .select('id, date, start_time, end_time, property, status')
        .eq('cleaner_id', cleanerId)
        .gte('date', today)
        .not('status', 'in', '(completed,cancelled)')
        .order('date', { ascending: true });

      if (errId) {
        console.error('Error fetching future tasks by cleaner_id:', errId);
        throw errId;
      }

      let tasks = byId || [];

      // También las asignadas solo por nombre (sin cleaner_id)
      if (cleanerName) {
        const { data: byName, error: errName } = await supabase
          .from('tasks')
          .select('id, date, start_time, end_time, property, status')
          .eq('cleaner', cleanerName)
          .is('cleaner_id', null)
          .gte('date', today)
          .not('status', 'in', '(completed,cancelled)');

        if (errName) {
          console.error('Error fetching future tasks by cleaner name:', errName);
        } else if (byName) {
          const seen = new Set(tasks.map(t => t.id));
          byName.forEach(t => {
            if (!seen.has(t.id)) tasks.push(t);
          });
        }
      }

      return tasks;
    },
    enabled: !!cleanerId,
    staleTime: 30_000,
  });
};

/**
 * Desactiva al trabajador y, opcionalmente, desasigna sus tareas futuras
 * (hoy o posterior) que no estén completadas o canceladas.
 */
export const useDeactivateCleaner = () => {
  const queryClient = useQueryClient();
  const { invalidateCleaners, invalidateTasks } = useCacheInvalidation();

  return useMutation({
    mutationFn: async ({
      cleanerId,
      cleanerName,
      unassignFutureTasks,
    }: {
      cleanerId: string;
      cleanerName: string;
      unassignFutureTasks: boolean;
    }) => {
      let unassignedCount = 0;

      if (unassignFutureTasks) {
        const today = format(new Date(), 'yyyy-MM-dd');

        // Desasignar por cleaner_id
        const { data: unassignedById, error: errId } = await supabase
          .from('tasks')
          .update({
            cleaner: null,
            cleaner_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('cleaner_id', cleanerId)
          .gte('date', today)
          .not('status', 'in', '(completed,cancelled)')
          .select('id');

        if (errId) {
          console.error('Error unassigning future tasks by cleaner_id:', errId);
          throw new Error(`No se pudieron desasignar las tareas: ${errId.message}`);
        }
        unassignedCount += unassignedById?.length || 0;

        // Desasignar por nombre (sin cleaner_id)
        if (cleanerName) {
          const { data: unassignedByName, error: errName } = await supabase
            .from('tasks')
            .update({
              cleaner: null,
              cleaner_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('cleaner', cleanerName)
            .is('cleaner_id', null)
            .gte('date', today)
            .not('status', 'in', '(completed,cancelled)')
            .select('id');

          if (errName) {
            console.error('Error unassigning future tasks by cleaner name:', errName);
          } else {
            unassignedCount += unassignedByName?.length || 0;
          }
        }
      }

      // Desactivar al trabajador
      const { error: updateError } = await supabase
        .from('cleaners')
        .update({ is_active: false })
        .eq('id', cleanerId);

      if (updateError) {
        console.error('Error deactivating cleaner:', updateError);
        throw new Error(`No se pudo desactivar al trabajador: ${updateError.message}`);
      }

      return { unassignedCount };
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
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo desactivar al trabajador.',
        variant: 'destructive',
      });
    },
  });
};
