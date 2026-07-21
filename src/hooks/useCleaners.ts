
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Cleaner } from '@/types/calendar';
import { cleanerStorage, CreateCleanerData } from '@/services/storage/cleanerStorage';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSede } from '@/contexts/SedeContext';
import { useCacheInvalidation } from './useCacheInvalidation';

export const useCleaners = () => {
  const { userRole, user } = useAuth();
  const { activeSede, isInitialized, loading } = useSede();
  
  const query = useQuery({
    queryKey: ['cleaners', activeSede?.id || 'pending-sede'],
    queryFn: () => cleanerStorage.getAll(),
    enabled: isInitialized && !loading && !!activeSede?.id,
  });

  const { data: allCleaners = [], isLoading } = query;

  // Filter cleaners based on user role
  const cleaners = React.useMemo(() => {
    if (userRole === 'cleaner' && user?.id) {
      // Cleaners only see themselves
      return allCleaners.filter(cleaner => cleaner.user_id === user.id);
    }
    
    // Admins, managers, supervisors see all cleaners
    return allCleaners;
  }, [allCleaners, userRole, user?.id]);

  return {
    cleaners,
    isLoading,
    isInitialLoading: isLoading && query.fetchStatus !== 'idle',
    refetch: query.refetch,
  };
};

export const useCleaner = (id: string) => {
  const { activeSede } = useSede();
  
  return useQuery({
    queryKey: ['cleaner', id, activeSede?.id],
    queryFn: () => cleanerStorage.getById(id),
    enabled: !!id && !!activeSede?.id,
  });
};

export const useCreateCleaner = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();
  const { invalidateCleaners } = useCacheInvalidation();

  return useMutation({
    mutationFn: async (cleanerData: CreateCleanerData) => {
      // Create the cleaner
      const newCleaner = await cleanerStorage.create(cleanerData);
      
      // Create full availability (all days, 06:00-23:00)
      if (newCleaner?.id) {
        const { supabase } = await import('@/integrations/supabase/client');
        const availabilityRecords = Array.from({ length: 7 }, (_, dayOfWeek) => ({
          cleaner_id: newCleaner.id,
          day_of_week: dayOfWeek,
          is_available: true,
          start_time: '06:00',
          end_time: '23:00',
        }));
        
        const { error: availError } = await supabase.from('cleaner_availability').insert(availabilityRecords);
        if (availError) {
          console.error('Error creating availability records:', availError);
          // Retry with upsert to handle any conflicts
          for (const record of availabilityRecords) {
            await supabase.from('cleaner_availability').upsert(record, {
              onConflict: 'cleaner_id,day_of_week',
              ignoreDuplicates: false,
            });
          }
        }
      }
      
      return newCleaner;
    },
    onSuccess: () => {
      invalidateCleaners();
      queryClient.invalidateQueries({ queryKey: ['cleaner-availability'] });
      toast({
        title: "Trabajador creado",
        description: "El trabajador ha sido creado con disponibilidad completa.",
      });
    },
    onError: (error) => {
      console.error('Create cleaner error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Ha ocurrido un error al crear el trabajador.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateCleaner = () => {
  const queryClient = useQueryClient();
  const { invalidateCleaners } = useCacheInvalidation();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreateCleanerData> }) => {
      const result = await cleanerStorage.update(id, updates);
      if (!result) throw new Error('Trabajador no encontrado');
      return result;
    },
    onSuccess: () => {
      invalidateCleaners();
      toast({
        title: "Trabajador actualizado",
        description: "Los datos del trabajador han sido actualizados.",
      });
    },
    onError: (error) => {
      console.error('Update cleaner error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Ha ocurrido un error al actualizar el trabajador.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateCleanersOrder = () => {
  const queryClient = useQueryClient();
  const { invalidateCleaners } = useCacheInvalidation();

  return useMutation({
    mutationFn: async (cleaners: { id: string; sortOrder: number }[]) => {
      return await cleanerStorage.updateOrder(cleaners);
    },
    onSuccess: () => {
      invalidateCleaners();
      toast({
        title: "Orden actualizado",
        description: "El orden de los trabajadores ha sido actualizado.",
      });
    },
    onError: (error) => {
      console.error('Update cleaners order error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al actualizar el orden.",
        variant: "destructive",
      });
    },
  });
};
