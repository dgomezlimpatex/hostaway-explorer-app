
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Task, ViewType } from '@/types/calendar';
import { taskStorageService } from '@/services/taskStorage';
import { useOptimizedTasks } from './useOptimizedTasks';

export const useTasks = (currentDate: Date, currentView: ViewType) => {
  const queryClient = useQueryClient();

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
      return taskStorageService.updateTask(taskId, updates);
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
      return taskStorageService.createTask(taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
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
      return taskStorageService.assignTask(taskId, cleaner.name, cleanerId);
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
    isUpdatingTask: updateTaskMutation.isPending,
    isCreatingTask: createTaskMutation.isPending,
    isDeletingTask: deleteTaskMutation.isPending,
    isDeletingAllTasks: deleteAllTasksMutation.isPending,
    isAssigningTask: assignTaskMutation.isPending,
  };
};
