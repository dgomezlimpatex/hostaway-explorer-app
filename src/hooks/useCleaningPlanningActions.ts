import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskStorageService } from '@/services/taskStorage';
import { multipleTaskAssignmentService, SetAssignmentsResult } from '@/services/storage/multipleTaskAssignmentService';
import { Cleaner, Task } from '@/types/calendar';
import { AssignmentProposal } from '@/types/cleaningPlanning';
import { useToast } from '@/hooks/use-toast';
import { validateProposalBatchForApply } from '@/utils/cleaning-planning/proposalBatchApply';
import { executeProposalBatch } from '@/utils/cleaning-planning/proposalBatchExecution';
import { recordPlanningCopilotApply } from '@/services/planning/copilot/planningAudit';

type ApplyProposalInput = {
  proposals: AssignmentProposal[];
  proposalSignature: string;
  activeSedeId?: string | null;
  activeCleanerIds: string[];
  expectedTasks: Task[];
  freshTasks: Task[];
};

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
    mutationFn: async ({
      proposals,
      proposalSignature,
      activeSedeId,
      activeCleanerIds,
      expectedTasks,
      freshTasks,
    }: ApplyProposalInput) => {
      const validation = validateProposalBatchForApply({
        proposals,
        proposalSignature,
        activeSedeId,
        activeCleanerIds,
        expectedTasks,
        freshTasks,
      });

      if (!validation.canApply) {
        const firstBlocked = validation.items.find((item) => item.status === 'blocked');
        throw new Error(firstBlocked?.message || 'La propuesta ya no es aplicable. Regenera antes de confirmar.');
      }

      let results: Array<{ taskId: string; result: SetAssignmentsResult }>;
      try {
        results = await executeProposalBatch(validation.taskPlans, {
          updateSchedule: (taskId, startTime, endTime) => taskStorageService.updateTask(taskId, {
            startTime,
            endTime,
          }),
          setAssignments: (taskId, cleanerIds) => multipleTaskAssignmentService.setTaskAssignments(
            taskId,
            cleanerIds,
            { notify: false },
          ),
        });
      } catch (error) {
        throw new Error(error instanceof Error
          ? `No se pudo aplicar la propuesta completa. Se intentó revertir responsables y horarios. Detalle: ${error.message}`
          : 'No se pudo aplicar la propuesta completa. Se intentó revertir responsables y horarios.');
      }

      for (const item of results) {
        await multipleTaskAssignmentService.notifyAssignmentDiff(item.taskId, item.result.added, item.result.removed);
      }
      recordPlanningCopilotApply({
        activeSedeId,
        proposals,
        validation,
        scope: {
          expectedTasks: expectedTasks.length,
          freshTasks: freshTasks.length,
        },
      });
      return { validation, results: results.map((item) => item.result) };
    },
    onSuccess: (data) => {
      invalidatePlanning();
      toast({
        title: 'Propuesta aplicada',
        description: `${data.validation.summary.readyTasks} tarea${data.validation.summary.readyTasks === 1 ? '' : 's'} actualizada${data.validation.summary.readyTasks === 1 ? '' : 's'} y notificada${data.validation.summary.readyTasks === 1 ? '' : 's'}.`,
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
