
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
  const { tasks, isLoading, isInitialLoading: isInitialLoadingTasks, error, queryKey } = useOptimizedTasks({
    currentDate,
    currentView
  });

  // Mutación para eliminar TODAS las tareas usando el nuevo método
  const deleteAllTasksMutation = useMutation({
    mutationFn: async () => {
      return await taskStorageService.deleteAllTasks();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      console.error('deleteAllTasksMutation - error:', error);
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) => {
      console.log('updateTaskMutation - updating task:', { taskId, updates });
      
      // Actualización optimista inmediata
      const currentDate = new Date().toISOString().split('T')[0];
      const sedeId = 'no-sede'; // TODO: get from context
      
      // Actualizar caché optimistamente
      const affectedDates = [updates.date, currentDate].filter(Boolean) as string[];
      affectedDates.forEach(date => {
        ['day', 'three-day', 'week'].forEach(view => {
          const queryKey = ['tasks', date, view, sedeId];
          queryClient.setQueryData(queryKey, (oldData: Task[] = []) => {
            return oldData.map(task => 
              task.id === taskId ? { ...task, ...updates } : task
            );
          });
        });
      });

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
      // Invalidación específica solo en las fechas afectadas
      const currentDate = new Date().toISOString().split('T')[0];
      const sedeId = 'no-sede'; // TODO: get from context
      const affectedDates = [variables.updates.date, currentDate].filter(Boolean);
      
      affectedDates.forEach(date => {
        ['day', 'three-day', 'week'].forEach(view => {
          queryClient.invalidateQueries({ 
            queryKey: ['tasks', date, view, sedeId] 
          });
        });
      });
      
      console.log('⚡ Optimized task update cache invalidation for dates:', affectedDates);
    },
    onError: (error, variables) => {
      // Revertir actualizaciones optimistas
      const currentDate = new Date().toISOString().split('T')[0];
      const sedeId = 'no-sede'; // TODO: get from context
      const affectedDates = [variables.updates.date, currentDate].filter(Boolean);
      
      affectedDates.forEach(date => {
        ['day', 'three-day', 'week'].forEach(view => {
          queryClient.invalidateQueries({ 
            queryKey: ['tasks', date, view, sedeId] 
          });
        });
      });
      
      console.error('Task update failed, reverted optimistic updates');
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Omit<Task, 'id'>) => {
      const result = await taskStorageService.createTask(taskData);
      
      // If a cleaner is assigned during creation, send assignment email
      if (result.cleanerId && result.cleaner) {
        await taskStorageService.assignTask(result.id, result.cleaner, result.cleanerId);
      }
      
      return result;
    },
    onSuccess: (data) => {
      console.log('✅ useTasks - createTaskMutation onSuccess:', data);
      
      // Force invalidate ALL task-related queries (more aggressive)
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      // Remove specific cached queries to force complete refresh
      queryClient.removeQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === 'tasks';
        }
      });
      
      console.log('🔄 useTasks - Invalidated and removed all task caches after create');
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
      
      
      // Delete the task directly - the taskCleanupService.deleteTask already handles sending cancellation emails
      const result = await taskStorageService.deleteTask(realTaskId);
      return result;
    },
    onSuccess: (data, taskId) => {
      console.log('✅ useTasks - deleteTask successful for taskId:', taskId);
      
      // Invalidate ALL task-related queries with broader pattern
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return Array.isArray(query.queryKey) && 
                 query.queryKey[0] === 'tasks';
        }
      });
      
      // Immediate cache removal to force refetch
      queryClient.removeQueries({ 
        predicate: (query) => {
          return Array.isArray(query.queryKey) && 
                 query.queryKey[0] === 'tasks';
        }
      });
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
    onMutate: async ({ taskId, cleanerId, cleaners }) => {
      const cleaner = cleaners.find(c => c.id === cleanerId);
      if (!cleaner) return;

      // Actualización optimista inmediata en TODAS las queries relevantes
      const currentDate = new Date().toISOString().split('T')[0];
      const sedeId = 'no-sede'; // TODO: get from context
      
      // Cancelar queries en vuelo
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      
      // Actualizar múltiples vistas y fechas
      const dates = [currentDate];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dates.push(tomorrow.toISOString().split('T')[0]);
      
      dates.forEach(date => {
        ['day', 'three-day', 'week'].forEach(view => {
          const queryKey = ['tasks', date, view, sedeId];
          queryClient.setQueryData(queryKey, (oldData: Task[] = []) => {
            return oldData.map(task => 
              task.id === taskId 
                ? { ...task, cleanerId, cleaner: cleaner.name }
                : task
            );
          });
        });
      });

      // También actualizar la query general de tasks si existe
      queryClient.setQueryData(['tasks'], (oldData: Task[] = []) => {
        return oldData.map(task => 
          task.id === taskId 
            ? { ...task, cleanerId, cleaner: cleaner.name }
            : task
        );
      });

      console.log('✅ Optimistic update applied for task assignment');
    },
    onSuccess: (data, variables) => {
      console.log('Task assigned successfully:', data);
      
      // Invalidación agresiva de TODAS las queries relacionadas con tasks
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return Array.isArray(query.queryKey) && 
                 query.queryKey[0] === 'tasks';
        }
      });
      
      // Forzar refetch inmediato
      queryClient.refetchQueries({ 
        predicate: (query) => {
          return Array.isArray(query.queryKey) && 
                 query.queryKey[0] === 'tasks';
        }
      });
      
      const cleaner = variables.cleaners.find(c => c.id === variables.cleanerId);
      toast({
        title: "Tarea asignada",
        description: `Se ha asignado la tarea a ${cleaner?.name} y se le ha enviado una notificación por email.`,
      });
      
      console.log('⚡ Forced aggressive task assignment cache invalidation and refetch');
    },
    onError: (error: any, variables) => {
      console.error('Error assigning task:', error);
      
      // Revertir actualización optimista
      const currentDate = new Date().toISOString().split('T')[0];
      const sedeId = 'no-sede'; // TODO: get from context
      
      ['day', 'three-day', 'week'].forEach(view => {
        queryClient.invalidateQueries({ 
          queryKey: ['tasks', currentDate, view, sedeId] 
        });
      });
      
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
      
      // Invalidación agresiva de TODAS las queries relacionadas con tasks
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return Array.isArray(query.queryKey) && 
                 query.queryKey[0] === 'tasks';
        }
      });
      
      // Forzar refetch inmediato
      queryClient.refetchQueries({ 
        predicate: (query) => {
          return Array.isArray(query.queryKey) && 
                 query.queryKey[0] === 'tasks';
        }
      });
      
      toast({
        title: "Tarea desasignada",
        description: "Se ha desasignado la tarea y se ha enviado una notificación por email.",
      });
      
      console.log('⚡ Forced aggressive task unassignment cache invalidation and refetch');
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
    isInitialLoading: isInitialLoadingTasks,
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
