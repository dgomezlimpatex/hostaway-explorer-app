import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskStorageService } from '@/services/taskStorage';
import { Cleaner } from '@/types/calendar';
import { AssignmentProposal } from '@/types/cleaningPlanning';
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

  const applyProposalMutation = useMutation({
    mutationFn: async ({ proposals }: { proposals: AssignmentProposal[] }) => {
      const results = [];
      for (const proposal of proposals) {
        results.push(await taskStorageService.assignTask(proposal.taskId, proposal.cleanerName, proposal.cleanerId));
      }
      return results;
    },
    onSuccess: (_data, variables) => {
      invalidatePlanning();
      toast({
        title: 'Propuesta aplicada',
        description: `${variables.proposals.length} asignación${variables.proposals.length === 1 ? '' : 'es'} guardada${variables.proposals.length === 1 ? '' : 's'}.`,
      });
    },
    onError: (error) => {
      invalidatePlanning();
      toast({
        title: 'Error al aplicar propuesta',
        description: error instanceof Error ? error.message : 'No se pudieron guardar las asignaciones propuestas.',
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
    applyProposal: applyProposalMutation.mutateAsync,
    assignTask: assignTaskMutation.mutate,
    unassignTask: unassignTaskMutation.mutate,
    isAssigning: assignTaskMutation.isPending || unassignTaskMutation.isPending,
    isApplyingProposal: applyProposalMutation.isPending,
  };
};
