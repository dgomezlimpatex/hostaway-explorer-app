import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  WorkerMaintenanceCleaning, 
  CreateWorkerMaintenanceCleaningInput,
  UpdateWorkerMaintenanceCleaningInput 
} from '@/types/workerAbsence';
import { toast } from 'sonner';

// Map database row to TypeScript type
const mapMaintenanceCleaningFromDB = (row: any): WorkerMaintenanceCleaning => ({
  id: row.id,
  cleanerId: row.cleaner_id,
  daysOfWeek: row.days_of_week,
  startTime: row.start_time,
  endTime: row.end_time,
  locationName: row.location_name,
  notes: row.notes,
  isActive: row.is_active,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Fetch maintenance cleanings for a specific cleaner
export const useWorkerMaintenanceCleanings = (cleanerId: string) => {
  return useQuery({
    queryKey: ['worker-maintenance-cleanings', cleanerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_maintenance_cleanings')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return (data || []).map(mapMaintenanceCleaningFromDB);
    },
    enabled: !!cleanerId,
  });
};

// Fetch all active maintenance cleanings (for calendar)
export const useAllWorkerMaintenanceCleanings = () => {
  return useQuery({
    queryKey: ['all-worker-maintenance-cleanings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_maintenance_cleanings')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      return (data || []).map(mapMaintenanceCleaningFromDB);
    },
  });
};

// Create maintenance cleaning
export const useCreateWorkerMaintenanceCleaning = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWorkerMaintenanceCleaningInput) => {
      const { data, error } = await supabase
        .from('worker_maintenance_cleanings')
        .insert({
          cleaner_id: input.cleanerId,
          days_of_week: input.daysOfWeek,
          start_time: input.startTime,
          end_time: input.endTime,
          location_name: input.locationName,
          notes: input.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return mapMaintenanceCleaningFromDB(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worker-maintenance-cleanings', variables.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-maintenance-cleanings'] });
      toast.success('Limpieza de mantenimiento creada');
    },
    onError: (error: Error) => {
      console.error('Error creating maintenance cleaning:', error);
      toast.error('Error al crear la limpieza de mantenimiento');
    },
  });
};

// Update maintenance cleaning
export const useUpdateWorkerMaintenanceCleaning = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateWorkerMaintenanceCleaningInput) => {
      const updateData: any = {};
      
      if (input.daysOfWeek !== undefined) updateData.days_of_week = input.daysOfWeek;
      if (input.startTime !== undefined) updateData.start_time = input.startTime;
      if (input.endTime !== undefined) updateData.end_time = input.endTime;
      if (input.locationName !== undefined) updateData.location_name = input.locationName;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;

      const { data, error } = await supabase
        .from('worker_maintenance_cleanings')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return mapMaintenanceCleaningFromDB(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['worker-maintenance-cleanings', data.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-maintenance-cleanings'] });
      toast.success('Limpieza de mantenimiento actualizada');
    },
    onError: (error: Error) => {
      console.error('Error updating maintenance cleaning:', error);
      toast.error('Error al actualizar la limpieza de mantenimiento');
    },
  });
};

// Delete maintenance cleaning
export const useDeleteWorkerMaintenanceCleaning = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cleanerId }: { id: string; cleanerId: string }) => {
      const { error } = await supabase
        .from('worker_maintenance_cleanings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, cleanerId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worker-maintenance-cleanings', variables.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-maintenance-cleanings'] });
      toast.success('Limpieza de mantenimiento eliminada');
    },
    onError: (error: Error) => {
      console.error('Error deleting maintenance cleaning:', error);
      toast.error('Error al eliminar la limpieza de mantenimiento');
    },
  });
};
