
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Task, ViewType } from '@/types/calendar';
import { taskStorageService } from '@/services/taskStorage';
import { taskAssignmentService } from '@/services/storage/taskAssignmentService';
import { useOptimizedTasks } from './useOptimizedTasks';
import { useToast } from '@/hooks/use-toast';

export const useTasks = (currentDate: Date, currentView: ViewType) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      // También invalidar el cache general
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Omit<Task, 'id'>) => {
      console.log('🔵 useTasks - createTaskMutation called with:', taskData);
      const result = await taskStorageService.createTask(taskData);
      console.log('✅ useTasks - taskStorageService.createTask result:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('✅ useTasks - createTaskMutation onSuccess:', data);
      // Invalidar TODAS las claves de caché relacionadas con tareas
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'tasks'
      });
      // Forzar refetch inmediato del cache general que usa useOptimizedTasks
      queryClient.removeQueries({ queryKey: ['tasks', 'all'] });
    },
    onError: (error) => {
      console.error('❌ useTasks - createTaskMutation onError:', error);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      // Check if task has a cleaner assigned to send cancellation email
      const currentTask = tasks.find(t => t.id === taskId);
      if (currentTask?.cleanerId) {
        // Use cancelTask instead of deleteTask to send email
        await taskStorageService.cancelTask(taskId);
      }
      // Then delete the task
      return taskStorageService.deleteTask(taskId);
    },
    onSuccess: (data, taskId) => {
      // Optimistic update
      queryClient.setQueryData(queryKey, (oldData: Task[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.filter(task => task.id !== taskId);
      });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
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
      // Optimistic update
      const cleaner = variables.cleaners.find(c => c.id === variables.cleanerId);
      queryClient.setQueryData(queryKey, (oldData: Task[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(task => 
          task.id === variables.taskId 
            ? { ...task, cleaner: cleaner?.name, cleanerId: variables.cleanerId }
            : task
        );
      });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
      
      // Show success message
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
      // Optimistic update
      queryClient.setQueryData(queryKey, (oldData: Task[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(task => 
          task.id === taskId 
            ? { ...task, cleaner: undefined, cleanerId: undefined }
            : task
        );
      });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
      
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
