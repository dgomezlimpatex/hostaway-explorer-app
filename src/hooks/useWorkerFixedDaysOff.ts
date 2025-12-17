import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WorkerFixedDayOff } from '@/types/workerAbsence';
import { toast } from 'sonner';

// Map database row to TypeScript type
const mapFixedDayOffFromDB = (row: any): WorkerFixedDayOff => ({
  id: row.id,
  cleanerId: row.cleaner_id,
  dayOfWeek: row.day_of_week,
  isActive: row.is_active,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Fetch fixed days off for a specific cleaner
export const useWorkerFixedDaysOff = (cleanerId: string) => {
  return useQuery({
    queryKey: ['worker-fixed-days-off', cleanerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_fixed_days_off')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .order('day_of_week', { ascending: true });

      if (error) throw error;
      return (data || []).map(mapFixedDayOffFromDB);
    },
    enabled: !!cleanerId,
  });
};

// Fetch all active fixed days off (for calendar)
export const useAllWorkerFixedDaysOff = () => {
  return useQuery({
    queryKey: ['all-worker-fixed-days-off'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_fixed_days_off')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      return (data || []).map(mapFixedDayOffFromDB);
    },
  });
};

// Toggle fixed day off (upsert)
export const useToggleWorkerFixedDayOff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      cleanerId, 
      dayOfWeek, 
      isActive 
    }: { 
      cleanerId: string; 
      dayOfWeek: number; 
      isActive: boolean 
    }) => {
      // First check if record exists
      const { data: existing } = await supabase
        .from('worker_fixed_days_off')
        .select('id')
        .eq('cleaner_id', cleanerId)
        .eq('day_of_week', dayOfWeek)
        .single();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('worker_fixed_days_off')
          .update({ is_active: isActive })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return mapFixedDayOffFromDB(data);
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('worker_fixed_days_off')
          .insert({
            cleaner_id: cleanerId,
            day_of_week: dayOfWeek,
            is_active: isActive,
          })
          .select()
          .single();

        if (error) throw error;
        return mapFixedDayOffFromDB(data);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worker-fixed-days-off', variables.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-fixed-days-off'] });
      toast.success(variables.isActive ? 'Día libre fijo activado' : 'Día libre fijo desactivado');
    },
    onError: (error: Error) => {
      console.error('Error toggling fixed day off:', error);
      toast.error('Error al actualizar el día libre fijo');
    },
  });
};

// Delete fixed day off
export const useDeleteWorkerFixedDayOff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cleanerId }: { id: string; cleanerId: string }) => {
      const { error } = await supabase
        .from('worker_fixed_days_off')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, cleanerId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worker-fixed-days-off', variables.cleanerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-fixed-days-off'] });
      toast.success('Día libre fijo eliminado');
    },
    onError: (error: Error) => {
      console.error('Error deleting fixed day off:', error);
      toast.error('Error al eliminar el día libre fijo');
    },
  });
};
