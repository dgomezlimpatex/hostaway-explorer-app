
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
    queryKey: ['cleaners', activeSede?.id || 'all'],
    queryFn: () => cleanerStorage.getAll(),
    enabled: isInitialized && !loading, // Wait for sede context to be fully initialized
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
    isInitialLoading: isLoading && query.fetchStatus !== 'idle'
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
      return await cleanerStorage.create(cleanerData);
    },
    onSuccess: () => {
      invalidateCleaners();
      toast({
        title: "Trabajador creado",
        description: "El trabajador ha sido creado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Create cleaner error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al crear el trabajador.",
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
        description: "Ha ocurrido un error al actualizar el trabajador.",
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

export const useDeleteCleaner = () => {
  const queryClient = useQueryClient();
  const { invalidateCleaners, invalidateTasks } = useCacheInvalidation();

  return useMutation({
    mutationFn: async (id: string) => {
      // First, unassign all tasks from this cleaner before deleting
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Update all tasks that have this cleaner_id to remove the assignment
      const { error: unassignError } = await supabase
        .from('tasks')
        .update({ 
          cleaner: null, 
          cleaner_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('cleaner_id', id);
      
      if (unassignError) {
        console.error('Error unassigning tasks from cleaner:', unassignError);
        throw new Error('Error al desasignar tareas del trabajador');
      }
      
      // Also delete any task_assignments for this cleaner
      const { error: assignmentError } = await supabase
        .from('task_assignments')
        .delete()
        .eq('cleaner_id', id);
      
      if (assignmentError) {
        console.error('Error deleting task assignments:', assignmentError);
        // Don't throw here, continue with cleaner deletion
      }
      
      // Now delete the cleaner
      const success = await cleanerStorage.delete(id);
      if (!success) throw new Error('Trabajador no encontrado');
      return success;
    },
    onSuccess: () => {
      invalidateCleaners();
      invalidateTasks(); // Also invalidate tasks since they were modified
      toast({
        title: "Trabajador eliminado",
        description: "El trabajador ha sido eliminado. Sus tareas asignadas han sido desasignadas.",
      });
    },
    onError: (error) => {
      console.error('Delete cleaner error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al eliminar el trabajador.",
        variant: "destructive",
      });
    },
  });
};
