import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Task } from '@/types/calendar';
import { taskStorageService } from '@/services/taskStorage';
import { taskAssignmentService } from '@/services/storage/taskAssignmentService';
import { useToast } from '@/hooks/use-toast';
import { useSede } from '@/contexts/SedeContext';

export const useOptimizedTaskMutations = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeSede } = useSede();

  // Función optimizada de invalidación de caché más específica
  const optimizedCacheInvalidation = (taskData?: Partial<Task>, operation?: string) => {
    // En lugar de invalidar TODO, ser más específico
    const currentDate = new Date().toISOString().split('T')[0];
    const sedeId = activeSede?.id || 'no-sede';

    // Invalidar solo las queries relevantes
    if (taskData?.date) {
      // Invalidar solo las queries de la fecha específica
      queryClient.invalidateQueries({ 
        queryKey: ['tasks', taskData.date, 'day', sedeId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['tasks', taskData.date, 'three-day', sedeId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['tasks', taskData.date, 'week', sedeId] 
      });
    } else {
      // Solo invalidar la fecha actual y cercanas
      const dates = [currentDate];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dates.push(tomorrow.toISOString().split('T')[0]);

      dates.forEach(date => {
        ['day', 'three-day', 'week'].forEach(view => {
          queryClient.invalidateQueries({ 
            queryKey: ['tasks', date, view, sedeId] 
          });
        });
      });
    }

    console.log(`⚡ Optimized cache invalidation for ${operation}`, taskData?.date || 'current date');
  };

  // Mutación optimizada para asignación de tareas
  const assignTaskOptimized = useMutation({
    mutationFn: async ({ taskId, cleanerId, cleaners }: { taskId: string; cleanerId: string; cleaners: any[] }) => {
      const cleaner = cleaners.find(c => c.id === cleanerId);
      if (!cleaner) throw new Error('Cleaner not found');

      // Actualización optimista inmediata
      const queryKey = ['tasks', new Date().toISOString().split('T')[0], 'day', activeSede?.id || 'no-sede'];
      queryClient.setQueryData(queryKey, (oldData: Task[] = []) => {
        return oldData.map(task => 
          task.id === taskId 
            ? { ...task, cleanerId, cleaner: cleaner.name }
            : task
        );
      });

      return await taskAssignmentService.assignTask(taskId, cleaner.name, cleanerId);
    },
    onSuccess: (data, variables) => {
      // Invalidación específica en lugar de global
      optimizedCacheInvalidation({ date: new Date().toISOString().split('T')[0] }, 'task assignment');
      
      const cleaner = variables.cleaners.find(c => c.id === variables.cleanerId);
      toast({
        title: "Tarea asignada",
        description: `Asignada a ${cleaner?.name}`,
      });
    },
    onError: (error: any, variables) => {
      // Revertir actualización optimista en caso de error
      const queryKey = ['tasks', new Date().toISOString().split('T')[0], 'day', activeSede?.id || 'no-sede'];
      queryClient.invalidateQueries({ queryKey });
      
      toast({
        title: "Error",
        description: error.message || "No se pudo asignar la tarea",
        variant: "destructive",
      });
    },
  });

  // Mutación optimizada para actualización de tareas
  const updateTaskOptimized = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) => {
      // Actualización optimista
      const affectedDates = [updates.date, new Date().toISOString().split('T')[0]].filter(Boolean);
      
      affectedDates.forEach(date => {
        ['day', 'three-day', 'week'].forEach(view => {
          const queryKey = ['tasks', date, view, activeSede?.id || 'no-sede'];
          queryClient.setQueryData(queryKey, (oldData: Task[] = []) => {
            return oldData.map(task => 
              task.id === taskId 
                ? { ...task, ...updates }
                : task
            );
          });
        });
      });

      const currentTasks = queryClient.getQueryData(['tasks']) as Task[] || [];
      const currentTask = currentTasks.find(t => t.id === taskId);
      
      const isScheduleChange = currentTask && (
        (updates.date && updates.date !== currentTask.date) ||
        (updates.startTime && updates.startTime !== currentTask.startTime) ||
        (updates.endTime && updates.endTime !== currentTask.endTime)
      );
      
      if (isScheduleChange && currentTask) {
        return taskStorageService.updateTaskSchedule(taskId, updates, currentTask);
      } else {
        return taskStorageService.updateTask(taskId, updates);
      }
    },
    onSuccess: (data, variables) => {
      optimizedCacheInvalidation(variables.updates, 'task update');
    },
    onError: (error: any, variables) => {
      // Revertir actualizaciones optimistas
      optimizedCacheInvalidation(variables.updates, 'task update error');
      
      toast({
        title: "Error",
        description: "No se pudo actualizar la tarea",
        variant: "destructive",
      });
    },
  });

  // Mutación optimizada para creación de tareas
  const createTaskOptimized = useMutation({
    mutationFn: async (taskData: Omit<Task, 'id'>) => {
      const result = await taskStorageService.createTask(taskData);
      
      // Actualización optimista inmediata
      const queryKey = ['tasks', taskData.date, 'day', activeSede?.id || 'no-sede'];
      queryClient.setQueryData(queryKey, (oldData: Task[] = []) => {
        return [...oldData, result];
      });

      if (result.cleanerId && result.cleaner) {
        await taskStorageService.assignTask(result.id, result.cleaner, result.cleanerId);
      }
      
      return result;
    },
    onSuccess: (data) => {
      optimizedCacheInvalidation({ date: data.date }, 'task creation');
    },
    onError: (error) => {
      console.error('Error creating task:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la tarea",
        variant: "destructive",
      });
    },
  });

  return {
    assignTask: assignTaskOptimized.mutate,
    updateTask: updateTaskOptimized.mutate,
    createTask: createTaskOptimized.mutate,
    isAssigningTask: assignTaskOptimized.isPending,
    isUpdatingTask: updateTaskOptimized.isPending,
    isCreatingTask: createTaskOptimized.isPending,
  };
};