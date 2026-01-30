
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Task, ViewType } from '@/types/calendar';
import { taskStorageService } from '@/services/taskStorage';
import { taskAssignmentService } from '@/services/storage/taskAssignmentService';
import { useOptimizedTasks } from './useOptimizedTasks';
import { useToast } from '@/hooks/use-toast';
import { useCacheInvalidation } from './useCacheInvalidation';
import { useSedeContext } from './useSedeContext';
import { useSede } from '@/contexts/SedeContext';
import { logger } from '@/utils/logger';

export const useTasks = (currentDate: Date, currentView: ViewType) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { invalidateTasks } = useCacheInvalidation();
  const { isSedeActive, waitForActiveSede, refreshSedes } = useSedeContext();
  const { activeSede } = useSede();
  
  // Obtener sedeId del contexto real en lugar de hardcodearlo
  const sedeId = activeSede?.id || 'no-sede';

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
      logger.log('updateTaskMutation - updating task:', { taskId, updates });
      
      // Actualización optimista inmediata
      const currentDateStr = new Date().toISOString().split('T')[0];
      
      // Actualizar caché optimistamente
      const affectedDates = [updates.date, currentDateStr].filter(Boolean) as string[];
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
      const currentDateStr = new Date().toISOString().split('T')[0];
      const affectedDates = [variables.updates.date, currentDateStr].filter(Boolean);
      
      affectedDates.forEach(date => {
        ['day', 'three-day', 'week'].forEach(view => {
          queryClient.invalidateQueries({ 
            queryKey: ['tasks', date, view, sedeId] 
          });
        });
      });
      
      logger.log('⚡ Optimized task update cache invalidation for dates:', affectedDates);
    },
    onError: (error, variables) => {
      // Revertir actualizaciones optimistas
      const currentDateStr = new Date().toISOString().split('T')[0];
      const affectedDates = [variables.updates.date, currentDateStr].filter(Boolean);
      
      affectedDates.forEach(date => {
        ['day', 'three-day', 'week'].forEach(view => {
          queryClient.invalidateQueries({ 
            queryKey: ['tasks', date, view, sedeId] 
          });
        });
      });
      
      logger.error('Task update failed, reverted optimistic updates');
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Omit<Task, 'id'>) => {
      logger.log('🎯 createTaskMutation - Starting task creation');
      
      // Verificar sede activa antes de proceder
      if (!isSedeActive()) {
        logger.log('🏢 No active sede, attempting to refresh and wait...');
        try {
          // Primero intentar refrescar las sedes
          await refreshSedes();
          // Luego esperar por sede activa con timeout más largo
          await waitForActiveSede(10000); // 10 segundos
          logger.log('✅ Sede active después del refresh');
        } catch (error) {
          logger.error('❌ No se pudo obtener sede activa después del refresh:', error);
          throw new Error('No se puede crear la tarea: no hay sede activa. Por favor, verifica tu conexión y vuelve a intentar.');
        }
      }
      
      const result = await taskStorageService.createTask(taskData);
      
      // If a cleaner is assigned during creation, send assignment email
      if (result.cleanerId && result.cleaner) {
        await taskStorageService.assignTask(result.id, result.cleaner, result.cleanerId);
      }
      
      return result;
    },
    onSuccess: (data) => {
      logger.log('✅ useTasks - createTaskMutation onSuccess:', data);
      
      // Force invalidate ALL task-related queries (more aggressive)
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      // Remove specific cached queries to force complete refresh
      queryClient.removeQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === 'tasks';
        }
      });
      
      logger.log('🔄 useTasks - Invalidated and removed all task caches after create');
    },
    onError: (error) => {
      logger.error('❌ useTasks - createTaskMutation onError:', error);
      
      // Mostrar mensaje de error más claro al usuario
      toast({
        title: "Error al crear tarea",
        description: error.message || "No se pudo crear la tarea. Por favor, intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      logger.log('🗑️ useTasks - deleteTask called with taskId:', taskId);
      
      // Find the task by either id or originalTaskId to get the real task id
      const currentTask = tasks.find(t => t.id === taskId || t.originalTaskId === taskId);
      const realTaskId = currentTask?.originalTaskId || taskId;
      
      // Delete the task directly - the taskCleanupService.deleteTask already handles sending cancellation emails
      const result = await taskStorageService.deleteTask(realTaskId);
      return result;
    },
    onSuccess: (data, taskId) => {
      logger.log('✅ useTasks - deleteTask successful for taskId:', taskId);
      
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

      logger.log('assignTaskMutation - assigning task:', { taskId, cleanerId, cleanerName: cleaner.name });
      
      // Use the assignment service which handles email notifications
      return await taskAssignmentService.assignTask(taskId, cleaner.name, cleanerId);
    },
    onMutate: async ({ taskId, cleanerId, cleaners }) => {
      const cleaner = cleaners.find(c => c.id === cleanerId);
      if (!cleaner) return;

      // Actualización optimista inmediata en TODAS las queries relevantes
      const currentDateStr = new Date().toISOString().split('T')[0];
      
      // Cancelar queries en vuelo
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      
      // Actualizar múltiples vistas y fechas
      const dates = [currentDateStr];
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

      logger.log('✅ Optimistic update applied for task assignment');
    },
    onSuccess: (data, variables) => {
      logger.log('Task assigned successfully:', data);
      
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
      
      logger.log('⚡ Forced aggressive task assignment cache invalidation and refetch');
    },
    onError: (error: any, variables) => {
      logger.error('Error assigning task:', error);
      
      // Revertir actualización optimista
      const currentDateStr = new Date().toISOString().split('T')[0];
      
      ['day', 'three-day', 'week'].forEach(view => {
        queryClient.invalidateQueries({ 
          queryKey: ['tasks', currentDateStr, view, sedeId] 
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
      logger.log('unassignTaskMutation - unassigning task:', taskId);
      return await taskAssignmentService.unassignTask(taskId);
    },
    onSuccess: (data, taskId) => {
      logger.log('Task unassigned successfully:', data);
      
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
      
      logger.log('⚡ Forced aggressive task unassignment cache invalidation and refetch');
    },
    onError: (error: any) => {
      logger.error('Error unassigning task:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo desasignar la tarea.",
        variant: "destructive",
      });
    },
  });

  // Batch create tasks using the Edge Function
  const batchCreateTasksMutation = useMutation({
    mutationFn: async ({ tasks, sendEmails = true }: { tasks: Omit<Task, 'id'>[]; sendEmails?: boolean }) => {
      logger.log(`📦 batchCreateTasksMutation - Creating ${tasks.length} tasks`);
      
      // Verificar sede activa antes de proceder
      if (!isSedeActive()) {
        logger.log('🏢 No active sede, attempting to refresh and wait...');
        try {
          await refreshSedes();
          await waitForActiveSede(10000);
          logger.log('✅ Sede active después del refresh');
        } catch (error) {
          logger.error('❌ No se pudo obtener sede activa después del refresh:', error);
          throw new Error('No se puede crear las tareas: no hay sede activa.');
        }
      }
      
      const response = await fetch(
        'https://qyipyygojlfhdghnraus.supabase.co/functions/v1/batch-create-tasks',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5aXB5eWdvamxmaGRnaG5yYXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1NTUyNTYsImV4cCI6MjA2NTEzMTI1Nn0.8L48rM_j_95tM37KRB6pBo4PgsLcHWoMMMO-OkPGw2Q`,
          },
          body: JSON.stringify({
            tasks: tasks.map(task => ({
              property: task.property,
              address: task.address,
              date: task.date,
              startTime: task.startTime,
              endTime: task.endTime,
              type: task.type,
              status: task.status,
              checkIn: task.checkIn,
              checkOut: task.checkOut,
              clienteId: task.clienteId,
              propertyId: task.propertyId,
              duration: task.duration,
              cost: task.cost,
              paymentMethod: task.paymentMethod,
              supervisor: task.supervisor,
              cleanerId: task.cleanerId,
              cleanerName: task.cleaner,
              // Note: cleanerEmail would need to be fetched from cleaners list if needed
            })),
            sedeId,
            sendEmails,
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create batch tasks');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      logger.log(`✅ Batch created ${data.created} tasks, ${data.emailsSent} emails sent`);
      
      // Single cache invalidation for all tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.removeQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === 'tasks';
        }
      });
      
      logger.log('🔄 Cache invalidated after batch create');
    },
    onError: (error) => {
      logger.error('❌ Batch create failed:', error);
      toast({
        title: "Error al crear tareas",
        description: error.message || "No se pudieron crear las tareas.",
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
    batchCreateTasks: batchCreateTasksMutation.mutateAsync,
    deleteTask: deleteTaskMutation.mutate,
    deleteAllTasks: deleteAllTasksMutation.mutate,
    assignTask: assignTaskMutation.mutate,
    unassignTask: unassignTaskMutation.mutate,
    isUpdatingTask: updateTaskMutation.isPending,
    isCreatingTask: createTaskMutation.isPending,
    isBatchCreating: batchCreateTasksMutation.isPending,
    isDeletingTask: deleteTaskMutation.isPending,
    isDeletingAllTasks: deleteAllTasksMutation.isPending,
    isAssigningTask: assignTaskMutation.isPending,
    isUnassigningTask: unassignTaskMutation.isPending,
  };
};
