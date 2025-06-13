
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CleanerAvailability } from './useCleanerAvailability';

export const useAllCleanersAvailability = () => {
  return useQuery({
    queryKey: ['all-cleaners-availability'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cleaner_availability')
        .select('*')
        .order('cleaner_id, day_of_week');

      if (error) throw error;
      return data as CleanerAvailability[];
    },
  });
};
