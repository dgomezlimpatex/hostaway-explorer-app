
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useCacheInvalidation } from './useCacheInvalidation';

export interface CleanerAvailability {
  id: string;
  cleaner_id: string;
  day_of_week: number;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAvailabilityData {
  cleaner_id: string;
  day_of_week: number;
  is_available: boolean;
  start_time?: string;
  end_time?: string;
}

export const useCleanerAvailability = (cleanerId: string) => {
  return useQuery({
    queryKey: ['cleaner-availability', cleanerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cleaner_availability')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .order('day_of_week');

      if (error) throw error;
      return data as CleanerAvailability[];
    },
    enabled: !!cleanerId,
  });
};

export const useCreateOrUpdateAvailability = () => {
  const queryClient = useQueryClient();
  const { invalidateCleaners } = useCacheInvalidation();

  return useMutation({
    mutationFn: async (data: CreateAvailabilityData) => {
      const { data: result, error } = await supabase
        .from('cleaner_availability')
        .upsert(data, { 
          onConflict: 'cleaner_id,day_of_week',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cleaner-availability'] });
      queryClient.invalidateQueries({ queryKey: ['all-cleaners-availability'] });
      invalidateCleaners();
      toast({
        title: "Disponibilidad actualizada",
        description: "Los horarios del trabajador han sido actualizados.",
      });
    },
    onError: (error) => {
      console.error('Error updating availability:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al actualizar la disponibilidad.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteAvailability = () => {
  const queryClient = useQueryClient();
  const { invalidateCleaners } = useCacheInvalidation();

  return useMutation({
    mutationFn: async ({ id, cleanerId }: { id: string; cleanerId: string }) => {
      const { error } = await supabase
        .from('cleaner_availability')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, cleanerId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cleaner-availability'] });
      queryClient.invalidateQueries({ queryKey: ['all-cleaners-availability'] });
      invalidateCleaners();
      toast({
        title: "Disponibilidad eliminada",
        description: "El horario ha sido eliminado.",
      });
    },
    onError: (error) => {
      console.error('Error deleting availability:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al eliminar la disponibilidad.",
        variant: "destructive",
      });
    },
  });
};
