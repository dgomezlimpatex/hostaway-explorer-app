
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recurringTaskStorage } from '@/services/recurringTaskStorage';
import { RecurringTask } from '@/types/recurring';
import { toast } from '@/hooks/use-toast';

export const useRecurringTasks = () => {
  return useQuery({
    queryKey: ['recurring-tasks'],
    queryFn: () => recurringTaskStorage.getAll(),
  });
};

export const useRecurringTask = (id: string) => {
  return useQuery({
    queryKey: ['recurring-task', id],
    queryFn: () => recurringTaskStorage.getById(id),
    enabled: !!id,
  });
};

export const useCreateRecurringTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskData: Omit<RecurringTask, 'id' | 'createdAt' | 'nextExecution'>) => {
      return Promise.resolve(recurringTaskStorage.create(taskData));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-tasks'] });
      toast({
        title: "Tarea recurrente creada",
        description: "La tarea recurrente ha sido configurada exitosamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Ha ocurrido un error al crear la tarea recurrente.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateRecurringTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<RecurringTask> }) => {
      return Promise.resolve(recurringTaskStorage.update(id, updates));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-task'] });
      toast({
        title: "Tarea recurrente actualizada",
        description: "Los cambios han sido guardados exitosamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Ha ocurrido un error al actualizar la tarea recurrente.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteRecurringTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => {
      return Promise.resolve(recurringTaskStorage.delete(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-tasks'] });
      toast({
        title: "Tarea recurrente eliminada",
        description: "La tarea recurrente ha sido eliminada exitosamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Ha ocurrido un error al eliminar la tarea recurrente.",
        variant: "destructive",
      });
    },
  });
};

export const useProcessRecurringTasks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      return Promise.resolve(recurringTaskStorage.processRecurringTasks());
    },
    onSuccess: (generatedTasks) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-tasks'] });
      
      if (generatedTasks.length > 0) {
        toast({
          title: "Tareas generadas",
          description: `Se han generado ${generatedTasks.length} tareas desde plantillas recurrentes.`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Ha ocurrido un error al procesar las tareas recurrentes.",
        variant: "destructive",
      });
    },
  });
};
