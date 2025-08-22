
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Task, ViewType } from '@/types/calendar';
import { taskStorageService } from '@/services/taskStorage';
import { taskAssignmentService } from '@/services/storage/taskAssignmentService';
import { useOptimizedTasks } from './useOptimizedTasks';
import { useToast } from '@/hooks/use-toast';
import { useCacheInvalidation } from './useCacheInvalidation';

export const useTasks = (currentDate: Date, currentView: ViewType) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { invalidateTasks } = useCacheInvalidation();

  // Usar el hook optimizado en lugar del query básico
  const { tasks, isLoading, error, queryKey } = useOptimizedTasks({
    currentDate,
    currentView
  });

  // Mutación para eliminar TODAS las tareas usando el nuevo método
  const deleteAllTasksMutation = useMutation({
    mutationFn: async () => {
      console.log('deleteAllTasksMutation - using taskStorageService.deleteAllTasks');
      return await taskStorageService.deleteAllTasks();
    },
    onSuccess: () => {
      console.log('deleteAllTasksMutation - all tasks deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      console.error('deleteAllTasksMutation - error:', error);
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) => {
      console.log('updateTaskMutation - updating task:', { taskId, updates });
      
      // Get current task to check for schedule changes
      const currentTask = tasks.find(t => t.id === taskId);
      
      // Check if it's a schedule change (date, startTime, or endTime changed)
      const isScheduleChange = currentTask && (
        (updates.date && updates.date !== currentTask.date) ||
        (updates.startTime && updates.startTime !== currentTask.startTime) ||
        (updates.endTime && updates.endTime !== currentTask.endTime)
      );
      
      // Use appropriate service method
      if (isScheduleChange && currentTask) {
        return taskStorageService.updateTaskSchedule(taskId, updates, currentTask);
      } else {
        return taskStorageService.updateTask(taskId, updates);
      }
    },
    onSuccess: (data, variables) => {
      // Optimistic update más eficiente
      queryClient.setQueryData(queryKey, (oldData: Task[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(task => 
          task.id === variables.taskId 
            ? { ...task, ...variables.updates }
            : task
        );
      });
      
      // Invalidar caché específico del queryKey actual
      queryClient.invalidateQueries({ queryKey });
      invalidateTasks();
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Omit<Task, 'id'>) => {
      console.log('🔵 useTasks - createTaskMutation called with:', taskData);
      const result = await taskStorageService.createTask(taskData);
      console.log('✅ useTasks - taskStorageService.createTask result:', result);
      
      // If a cleaner is assigned during creation, send assignment email
      if (result.cleanerId && result.cleaner) {
        console.log('📧 Sending assignment email for newly created task with cleaner:', result.cleaner);
        await taskStorageService.assignTask(result.id, result.cleaner, result.cleanerId);
      }
      
      return result;
    },
    onSuccess: (data) => {
      console.log('✅ useTasks - createTaskMutation onSuccess:', data);
      
      // Immediate optimistic update to current query cache
      queryClient.setQueryData(queryKey, (oldData: Task[] | undefined) => {
        if (!oldData) return [data];
        return [...oldData, data];
      });
      
      // Force immediate refetch first to ensure data appears
      queryClient.refetchQueries({ queryKey });
      
      // Then invalidate all related caches for consistency
      invalidateTasks();
      
      // Additional invalidation for safety
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      console.error('❌ useTasks - createTaskMutation onError:', error);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      console.log('🗑️ useTasks - deleteTask called with taskId:', taskId);
      
      // Find the task by either id or originalTaskId to get the real task id
      const currentTask = tasks.find(t => t.id === taskId || t.originalTaskId === taskId);
      const realTaskId = currentTask?.originalTaskId || taskId;
      
      console.log('🗑️ useTasks - currentTask found:', currentTask);
      console.log('🗑️ useTasks - realTaskId to delete:', realTaskId);
      
      // Delete the task directly - the taskCleanupService.deleteTask already handles sending cancellation emails
      console.log('🗑️ useTasks - calling taskStorageService.deleteTask with realTaskId:', realTaskId);
      const result = await taskStorageService.deleteTask(realTaskId);
      console.log('🗑️ useTasks - deleteTask result:', result);
      return result;
    },
    onSuccess: (data, taskId) => {
      console.log('✅ useTasks - deleteTask successful for taskId:', taskId);
      
      // Get the task that was deleted to find the real task ID
      const currentTask = tasks.find(t => t.id === taskId || t.originalTaskId === taskId);
      const realTaskId = currentTask?.originalTaskId || taskId;
      
      // Optimistic update - remove from current view cache
      queryClient.setQueryData(queryKey, (oldData: Task[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.filter(task => 
          task.id !== taskId && 
          task.id !== realTaskId && 
          task.originalTaskId !== taskId && 
          task.originalTaskId !== realTaskId
        );
      });
      
      // Force immediate refetch to ensure removal appears
      queryClient.refetchQueries({ queryKey });
      
      // Then invalidate all related caches
      invalidateTasks();
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const assignTaskMutation = useMutation({
    mutationFn: async ({ taskId, cleanerId, cleaners }: { taskId: string; cleanerId: string; cleaners: any[] }) => {
      const cleaner = cleaners.find(c => c.id === cleanerId);
      if (!cleaner) {
        throw new Error('Cleaner not found');
      }
      console.log('assignTaskMutation - assigning task:', { taskId, cleanerId, cleanerName: cleaner.name });
      
      // Use the assignment service which handles email notifications
      return await taskAssignmentService.assignTask(taskId, cleaner.name, cleanerId);
    },
    onSuccess: (data, variables) => {
      console.log('Task assigned successfully:', data);
      
      // Immediate optimistic update
      queryClient.setQueryData(queryKey, (oldData: Task[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(task => 
          task.id === variables.taskId 
            ? { ...task, cleanerId: variables.cleanerId, cleaner: variables.cleaners.find(c => c.id === variables.cleanerId)?.name || task.cleaner }
            : task
        );
      });
      
      // Invalidar caché específico del queryKey actual primero
      queryClient.invalidateQueries({ queryKey });
      
      // Invalidate and refetch for consistency
      invalidateTasks();
      queryClient.refetchQueries({ queryKey });
      
      // Show success message
      const cleaner = variables.cleaners.find(c => c.id === variables.cleanerId);
      toast({
        title: "Tarea asignada",
        description: `Se ha asignado la tarea a ${cleaner?.name} y se le ha enviado una notificación por email.`,
      });
    },
    onError: (error: any) => {
      console.error('Error assigning task:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo asignar la tarea.",
        variant: "destructive",
      });
    },
  });

  const unassignTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      console.log('unassignTaskMutation - unassigning task:', taskId);
      return await taskAssignmentService.unassignTask(taskId);
    },
    onSuccess: (data, taskId) => {
      console.log('Task unassigned successfully:', data);
      
      // Immediate optimistic update
      queryClient.setQueryData(queryKey, (oldData: Task[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(task => 
          task.id === taskId 
            ? { ...task, cleanerId: undefined, cleaner: '' }
            : task
        );
      });
      
      // Invalidar caché específico del queryKey actual primero
      queryClient.invalidateQueries({ queryKey });
      
      // Invalidate and refetch for consistency
      invalidateTasks();
      queryClient.refetchQueries({ queryKey });
      
      // Show success message
      toast({
        title: "Tarea desasignada",
        description: "Se ha desasignado la tarea y se ha enviado una notificación por email.",
      });
    },
    onError: (error: any) => {
      console.error('Error unassigning task:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo desasignar la tarea.",
        variant: "destructive",
      });
    },
  });

  return {
    tasks,
    isLoading,
    error,
    updateTask: updateTaskMutation.mutate,
    createTask: createTaskMutation.mutate,
    deleteTask: deleteTaskMutation.mutate,
    deleteAllTasks: deleteAllTasksMutation.mutate,
    assignTask: assignTaskMutation.mutate,
    unassignTask: unassignTaskMutation.mutate,
    isUpdatingTask: updateTaskMutation.isPending,
    isCreatingTask: createTaskMutation.isPending,
    isDeletingTask: deleteTaskMutation.isPending,
    isDeletingAllTasks: deleteAllTasksMutation.isPending,
    isAssigningTask: assignTaskMutation.isPending,
    isUnassigningTask: unassignTaskMutation.isPending,
  };
};
