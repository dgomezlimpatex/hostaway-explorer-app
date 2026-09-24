import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskStorageService } from '@/services/taskStorage';
import { multipleTaskAssignmentService, SetAssignmentsResult } from '@/services/storage/multipleTaskAssignmentService';
import { Cleaner, Task } from '@/types/calendar';
import { AssignmentProposal } from '@/types/cleaningPlanning';
import { useToast } from '@/hooks/use-toast';
import { validateProposalBatchForApply } from '@/utils/cleaning-planning/proposalBatchApply';
import { executeProposalBatch } from '@/utils/cleaning-planning/proposalBatchExecution';
import { recordPlanningCopilotApply } from '@/services/planning/copilot/planningAudit';
import { materializeRecurringTaskInstance } from '@/services/recurringTaskInstanceService';

type ApplyProposalInput = {
  proposals: AssignmentProposal[];
  proposalSignature: string;
  activeSedeId?: string | null;
  activeCleanerIds: string[];
  expectedTasks: Task[];
  freshTasks: Task[];
};

/** Cambio rápido de horario sobre una tarea ya guardada. */
export type QuickScheduleChange = {
  task: Task;
  startTime: string;
  endTime: string;
};

/** Cambio rápido de responsable (y opcionalmente de horario) sobre una tarea ya guardada. */
export type QuickReassignment = {
  task: Task;
  cleaner: Cleaner;
  startTime?: string;
  endTime?: string;
};

export const useCleaningPlanningActions = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidatePlanning = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['cleaning-planning-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['recurring-tasks-for-calendar'] });
    queryClient.invalidateQueries({ queryKey: ['recurring-task-executions'] });
  };

  const assignTaskMutation = useMutation({
    mutationFn: async ({ task, cleaner }: { task: Task; cleaner: Cleaner }) => {
      if (task.isRecurringInstance) {
        return materializeRecurringTaskInstance(task, {
          cleaner: cleaner.name,
          cleanerId: cleaner.id,
          status: 'pending',
        });
      }
      return taskStorageService.assignTask(task.id, cleaner.name, cleaner.id);
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

      const expectedById = new Map(expectedTasks.map((task) => [task.id, task]));
      const executablePlans: typeof validation.taskPlans = [];
      for (const plan of validation.taskPlans) {
        const expectedTask = expectedById.get(plan.taskId);
        if (!expectedTask?.isRecurringInstance) {
          executablePlans.push(plan);
          continue;
        }

        const materializedTask = await materializeRecurringTaskInstance(expectedTask, {
          startTime: plan.proposedStartTime,
          endTime: plan.proposedEndTime,
          status: 'pending',
        });
        executablePlans.push({
          ...plan,
          taskId: materializedTask.id,
          previousCleanerIds: [],
          previousStartTime: materializedTask.startTime,
          previousEndTime: materializedTask.endTime,
        });
      }

      let results: Array<{ taskId: string; result: SetAssignmentsResult }>;
      try {
        results = await executeProposalBatch(executablePlans, {
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
        title: 'Reparto guardado',
        description: `${data.validation.summary.readyTasks} limpieza${data.validation.summary.readyTasks === 1 ? '' : 's'} guardada${data.validation.summary.readyTasks === 1 ? '' : 's'}; avisos iniciados.`,
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
    mutationFn: async (task: Task) => {
      if (task.isRecurringInstance) {
        return materializeRecurringTaskInstance(task, {
          cleaner: undefined,
          cleanerId: undefined,
          status: 'pending',
        });
      }
      return taskStorageService.unassignTask(task.id);
    },
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

  /**
   * Cambios rápidos (clic derecho en el tablero de planificación): se escriben al momento
   * sobre la tarea real, con los mismos servicios que usa el resto de la app.
   */
  const updateTaskScheduleMutation = useMutation({
    mutationFn: async ({ task, startTime, endTime }: QuickScheduleChange) => {
      if (task.isRecurringInstance) {
        return materializeRecurringTaskInstance(task, {
          cleaner: task.cleaner,
          cleanerId: task.cleanerId,
          startTime,
          endTime,
          status: 'pending',
        });
      }
      return taskStorageService.updateTaskSchedule(task.id, { startTime, endTime }, task);
    },
    onSuccess: () => {
      invalidatePlanning();
      toast({
        title: 'Horario actualizado',
        description: 'Se ha avisado a quien tiene la limpieza asignada.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo cambiar el horario',
        description: error instanceof Error ? error.message : 'La tarea no se ha modificado.',
        variant: 'destructive',
      });
    },
  });

  const reassignTaskMutation = useMutation({
    mutationFn: async ({ task, cleaner, startTime, endTime }: QuickReassignment) => {
      if (task.isRecurringInstance) {
        return materializeRecurringTaskInstance(task, {
          cleaner: cleaner.name,
          cleanerId: cleaner.id,
          ...(startTime && endTime ? { startTime, endTime } : {}),
          status: 'pending',
        });
      }
      return taskStorageService.assignTaskWithSchedule(
        task.id,
        cleaner.name,
        cleaner.id,
        startTime,
        endTime,
      );
    },
    onSuccess: (_data, variables) => {
      invalidatePlanning();
      toast({
        title: 'Limpieza reasignada',
        description: `Ahora la tiene ${variables.cleaner.name}.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo reasignar',
        description: error instanceof Error ? error.message : 'La tarea no se ha modificado.',
        variant: 'destructive',
      });
    },
  });

  return {
    applyProposal: applyProposalMutation.mutateAsync,
    assignTask: assignTaskMutation.mutate,
    unassignTask: unassignTaskMutation.mutate,
    unassignTaskAsync: unassignTaskMutation.mutateAsync,
    updateTaskSchedule: updateTaskScheduleMutation.mutateAsync,
    reassignTask: reassignTaskMutation.mutateAsync,
    isAssigning: assignTaskMutation.isPending || unassignTaskMutation.isPending,
    isSavingQuickAction:
      updateTaskScheduleMutation.isPending
      || reassignTaskMutation.isPending
      || unassignTaskMutation.isPending,
    isApplyingProposal: applyProposalMutation.isPending,
  };
};
