import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskStorageService } from '@/services/taskStorage';
import { Cleaner } from '@/types/calendar';
import { useToast } from '@/hooks/use-toast';

export const useCleaningPlanningActions = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidatePlanning = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['cleaning-planning-tasks'] });
  };

  const assignTaskMutation = useMutation({
    mutationFn: async ({ taskId, cleaner }: { taskId: string; cleaner: Cleaner }) => {
      return taskStorageService.assignTask(taskId, cleaner.name, cleaner.id);
    },
    onSuccess: () => {
      invalidatePlanning();
      toast({ title: 'Tarea asignada', description: 'La planificación se ha actualizado.' });
    },
    onError: (error) => {
      toast({
        title: 'Error al asignar',
        description: error instanceof Error ? error.message : 'No se pudo asignar la tarea.',
        variant: 'destructive',
      });
    },
  });

  const unassignTaskMutation = useMutation({
    mutationFn: async (taskId: string) => taskStorageService.unassignTask(taskId),
    onSuccess: () => {
      invalidatePlanning();
      toast({ title: 'Asignación retirada', description: 'La tarea vuelve a quedar sin asignar.' });
    },
    onError: (error) => {
      toast({
        title: 'Error al desasignar',
        description: error instanceof Error ? error.message : 'No se pudo desasignar la tarea.',
        variant: 'destructive',
      });
    },
  });

  return {
    assignTask: assignTaskMutation.mutate,
    unassignTask: unassignTaskMutation.mutate,
    isAssigning: assignTaskMutation.isPending || unassignTaskMutation.isPending,
  };
};
