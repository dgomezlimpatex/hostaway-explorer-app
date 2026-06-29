import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { propertyStorage } from '@/services/storage/propertyStorage';
import { CreatePropertyData } from '@/types/property';
import { toast } from '@/hooks/use-toast';
import { useSede } from '@/contexts/SedeContext';
import { useCacheInvalidation } from './useCacheInvalidation';
import { supabase } from '@/integrations/supabase/client';
import { formatMadridDate } from '@/utils/date';


export interface PropertyCleaningScheduleItem {
  taskId: string;
  date: string;
  startTime: string | null;
  status: string;
}

export interface PropertyCleaningSchedule {
  lastCleaning: PropertyCleaningScheduleItem | null;
  nextCleaning: PropertyCleaningScheduleItem | null;
}

type ScheduleTaskRow = {
  id: string;
  propiedad_id: string | null;
  date: string;
  start_time: string | null;
  status: string;
  task_reports?: Array<{ overall_status: string | null }> | null;
};

const COMPLETED_STATUSES = new Set(['completed', 'done', 'finished']);

const isCompletedTask = (task: ScheduleTaskRow) => (
  COMPLETED_STATUSES.has(task.status) ||
  task.task_reports?.some((report) => report.overall_status === 'completed')
);

export const useProperties = () => {
  const { activeSede, isInitialized, loading } = useSede();
  
  return useQuery({
    queryKey: ['properties', activeSede?.id || 'pending-sede'],
    queryFn: () => propertyStorage.getAll(),
    enabled: isInitialized && !loading && !!activeSede?.id,
  });
};

export const useProperty = (id: string) => {
  const { activeSede, isInitialized, loading } = useSede();
  
  return useQuery({
    queryKey: ['property', id, activeSede?.id || 'pending-sede'],
    queryFn: () => propertyStorage.getById(id),
    enabled: !!id && isInitialized && !loading && !!activeSede?.id,
  });
};

export const usePropertiesByClient = (clienteId: string) => {
  const { activeSede, isInitialized, loading } = useSede();
  
  return useQuery({
    queryKey: ['properties', 'client', clienteId, activeSede?.id || 'pending-sede'],
    queryFn: () => propertyStorage.getByClientId(clienteId),
    enabled: !!clienteId && isInitialized && !loading && !!activeSede?.id,
  });
};


export const usePropertyCleaningSchedule = (propertyIds: string[]) => {
  const { activeSede, isInitialized, loading } = useSede();
  const uniquePropertyIds = Array.from(new Set(propertyIds)).sort();

  return useQuery({
    queryKey: ['property-cleaning-schedule', activeSede?.id || 'pending-sede', uniquePropertyIds],
    enabled: uniquePropertyIds.length > 0 && isInitialized && !loading && !!activeSede?.id,
    queryFn: async (): Promise<Record<string, PropertyCleaningSchedule>> => {
      const scheduleByProperty = uniquePropertyIds.reduce<Record<string, PropertyCleaningSchedule>>((acc, propertyId) => {
        acc[propertyId] = { lastCleaning: null, nextCleaning: null };
        return acc;
      }, {});
      const today = formatMadridDate(new Date());
      let query = supabase
        .from('tasks')
        .select('id, propiedad_id, date, start_time, status, task_reports(overall_status)')
        .in('propiedad_id', uniquePropertyIds)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });
      if (activeSede?.id) query = query.eq('sede_id', activeSede.id);
      const { data, error } = await query;
      if (error) throw error;
      (data || []).forEach((task) => {
        const row = task as ScheduleTaskRow;
        if (!row.propiedad_id || !scheduleByProperty[row.propiedad_id]) return;
        const item: PropertyCleaningScheduleItem = {
          taskId: row.id,
          date: row.date,
          startTime: row.start_time,
          status: row.status,
        };
        const schedule = scheduleByProperty[row.propiedad_id];
        const completed = isCompletedTask(row);
        if (row.date <= today && completed) schedule.lastCleaning = item;
        if (row.date >= today && !completed && !schedule.nextCleaning) schedule.nextCleaning = item;
      });
      return scheduleByProperty;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateProperty = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();
  const { invalidateProperties } = useCacheInvalidation();

  return useMutation({
    mutationFn: async (propertyData: CreatePropertyData) => {
      return await propertyStorage.create(propertyData);
    },
    onSuccess: () => {
      invalidateProperties();
      toast({
        title: "Propiedad creada",
        description: "La propiedad ha sido creada exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Create property error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al crear la propiedad.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateProperty = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();
  const { invalidateProperties } = useCacheInvalidation();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreatePropertyData> }) => {
      const result = await propertyStorage.update(id, updates);
      if (!result) throw new Error('Propiedad no encontrada');
      return result;
    },
    onSuccess: () => {
      invalidateProperties();
      toast({
        title: "Propiedad actualizada",
        description: "Los datos de la propiedad han sido actualizados.",
      });
    },
    onError: (error) => {
      console.error('Update property error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al actualizar la propiedad.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteProperty = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();
  const { invalidateProperties } = useCacheInvalidation();

  return useMutation({
    mutationFn: async (id: string) => {
      const success = await propertyStorage.delete(id);
      if (!success) throw new Error('Propiedad no encontrada');
      return success;
    },
    onSuccess: () => {
      invalidateProperties();
      toast({
        title: "Propiedad eliminada",
        description: "La propiedad ha sido eliminada exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Delete property error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al eliminar la propiedad.",
        variant: "destructive",
      });
    },
  });
};