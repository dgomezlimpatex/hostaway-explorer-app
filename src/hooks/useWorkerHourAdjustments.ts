import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  HourAdjustment, 
  CreateHourAdjustmentInput, 
  UpdateHourAdjustmentInput 
} from '@/types/workload';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

// Map database row to TypeScript type
const mapAdjustmentFromDB = (row: any): HourAdjustment => ({
  id: row.id,
  cleanerId: row.cleaner_id,
  date: row.date,
  hours: Number(row.hours),
  category: row.category,
  reason: row.reason,
  notes: row.notes,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Fetch adjustments for a specific cleaner
export const useWorkerHourAdjustments = (cleanerId: string, startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: ['worker-hour-adjustments', cleanerId, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('worker_hour_adjustments')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .order('date', { ascending: false });

      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map(mapAdjustmentFromDB);
    },
    enabled: !!cleanerId,
  });
};

// Fetch all adjustments for a date range (all workers)
export const useAllWorkerHourAdjustments = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: ['all-worker-hour-adjustments', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_hour_adjustments')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;
      return (data || []).map(mapAdjustmentFromDB);
    },
    enabled: !!startDate && !!endDate,
  });
};

// Create adjustment
export const useCreateWorkerHourAdjustment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateHourAdjustmentInput) => {
      if (!user?.id) throw new Error('Usuario no autenticado');

      const { data, error } = await supabase
        .from('worker_hour_adjustments')
        .insert({
          cleaner_id: input.cleanerId,
          date: input.date,
          hours: input.hours,
          category: input.category,
          reason: input.reason,
          notes: input.notes || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return mapAdjustmentFromDB(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worker-hour-adjustments', variables.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-hour-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['workload'] });
      toast.success('Ajuste de horas creado');
    },
    onError: (error: Error) => {
      console.error('Error creating hour adjustment:', error);
      toast.error('Error al crear el ajuste de horas');
    },
  });
};

// Update adjustment
export const useUpdateWorkerHourAdjustment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateHourAdjustmentInput) => {
      const updateData: any = {};
      
      if (input.hours !== undefined) updateData.hours = input.hours;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.reason !== undefined) updateData.reason = input.reason;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const { data, error } = await supabase
        .from('worker_hour_adjustments')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return mapAdjustmentFromDB(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['worker-hour-adjustments', data.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-hour-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['workload'] });
      toast.success('Ajuste de horas actualizado');
    },
    onError: (error: Error) => {
      console.error('Error updating hour adjustment:', error);
      toast.error('Error al actualizar el ajuste de horas');
    },
  });
};

// Delete adjustment
export const useDeleteWorkerHourAdjustment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cleanerId }: { id: string; cleanerId: string }) => {
      const { error } = await supabase
        .from('worker_hour_adjustments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, cleanerId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worker-hour-adjustments', variables.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-hour-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['workload'] });
      toast.success('Ajuste de horas eliminado');
    },
    onError: (error: Error) => {
      console.error('Error deleting hour adjustment:', error);
      toast.error('Error al eliminar el ajuste de horas');
    },
  });
};
