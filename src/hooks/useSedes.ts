import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { sedeStorageService } from '@/services/storage/sedeStorage';
import { useSede } from '@/contexts/SedeContext';
import { CreateSedeData } from '@/types/sede';
import { useToast } from '@/hooks/use-toast';

const QUERY_KEYS = {
  sedes: ['sedes'] as const,
  userSedes: ['sedes', 'user'] as const,
  sedeAccess: (sedeId: string) => ['sedes', 'access', sedeId] as const,
};

export const useSedes = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Query para obtener todas las sedes
  const {
    data: allSedes = [],
    isLoading: allSedesLoading,
    error: allSedesError
  } = useQuery({
    queryKey: QUERY_KEYS.sedes,
    queryFn: () => sedeStorageService.getActiveSedes(),
  });

  // Query para obtener sedes accesibles por el usuario
  const {
    data: userSedes = [],
    isLoading: userSedesLoading,
    error: userSedesError,
    refetch: refreshUserSedes
  } = useQuery({
    queryKey: QUERY_KEYS.userSedes,
    queryFn: () => sedeStorageService.getUserAccessibleSedes(),
  });

  // Mutation para crear nueva sede
  const createSedeMutation = useMutation({
    mutationFn: (sedeData: CreateSedeData) => sedeStorageService.createSede(sedeData),
    onSuccess: async (newSede) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sedes });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userSedes });
      
      // Log de auditoría para creación de sede
      try {
        await supabase.rpc('log_sede_event', {
          event_type_param: 'sede_created',
          to_sede_id_param: newSede.id,
          event_data_param: {
            sede_name: newSede.nombre,
            sede_code: newSede.codigo,
            ciudad: newSede.ciudad,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Error logging sede creation:', error);
      }
      
      toast({
        title: "Sede creada",
        description: "La sede ha sido creada exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error creating sede:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la sede. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Mutation para actualizar sede
  const updateSedeMutation = useMutation({
    mutationFn: ({ sedeId, updates }: { sedeId: string; updates: Partial<CreateSedeData> }) =>
      sedeStorageService.updateSede(sedeId, updates),
    onSuccess: async (updatedSede, { sedeId, updates }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sedes });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userSedes });
      
      // Log de auditoría para actualización de sede
      try {
        await supabase.rpc('log_sede_event', {
          event_type_param: 'sede_updated',
          to_sede_id_param: sedeId,
          event_data_param: {
            updates: updates,
            sede_name: updatedSede?.nombre,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Error logging sede update:', error);
      }
      
      toast({
        title: "Sede actualizada",
        description: "Los cambios han sido guardados exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error updating sede:', error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los cambios. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Mutation para desactivar sede
  const deactivateSedeMutation = useMutation({
    mutationFn: (sedeId: string) => sedeStorageService.deactivateSede(sedeId),
    onSuccess: async (_, sedeId) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sedes });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userSedes });
      
      // Log de auditoría para desactivación de sede
      try {
        await supabase.rpc('log_sede_event', {
          event_type_param: 'sede_deactivated',
          to_sede_id_param: sedeId,
          event_data_param: {
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Error logging sede deactivation:', error);
      }
      
      toast({
        title: "Sede desactivada",
        description: "La sede ha sido desactivada exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error deactivating sede:', error);
      toast({
        title: "Error",
        description: "No se pudo desactivar la sede. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Mutation para otorgar acceso a sede
  const grantSedeAccessMutation = useMutation({
    mutationFn: ({ userId, sedeId }: { userId: string; sedeId: string }) =>
      sedeStorageService.grantUserSedeAccess(userId, sedeId),
    onSuccess: async (_, { userId, sedeId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userSedes });
      
      // Log de auditoría para otorgar acceso
      try {
        await supabase.rpc('log_sede_event', {
          event_type_param: 'sede_access_granted',
          to_sede_id_param: sedeId,
          event_data_param: {
            target_user_id: userId,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Error logging sede access grant:', error);
      }
      
      toast({
        title: "Acceso otorgado",
        description: "El usuario ahora tiene acceso a la sede.",
      });
    },
    onError: (error) => {
      console.error('Error granting sede access:', error);
      toast({
        title: "Error",
        description: "No se pudo otorgar el acceso. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Mutation para revocar acceso a sede
  const revokeSedeAccessMutation = useMutation({
    mutationFn: ({ userId, sedeId }: { userId: string; sedeId: string }) =>
      sedeStorageService.revokeUserSedeAccess(userId, sedeId),
    onSuccess: async (_, { userId, sedeId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userSedes });
      
      // Log de auditoría para revocar acceso
      try {
        await supabase.rpc('log_sede_event', {
          event_type_param: 'sede_access_revoked',
          to_sede_id_param: sedeId,
          event_data_param: {
            target_user_id: userId,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Error logging sede access revoke:', error);
      }
      
      toast({
        title: "Acceso revocado",
        description: "El acceso del usuario a la sede ha sido revocado.",
      });
    },
    onError: (error) => {
      console.error('Error revoking sede access:', error);
      toast({
        title: "Error",
        description: "No se pudo revocar el acceso. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  return {
    // Datos
    allSedes,
    userSedes,
    
    // Estados de carga
    allSedesLoading,
    userSedesLoading,
    loading: allSedesLoading || userSedesLoading,
    
    // Errores
    allSedesError,
    userSedesError,
    hasError: !!allSedesError || !!userSedesError,
    
    // Acciones
    createSede: createSedeMutation.mutate,
    updateSede: updateSedeMutation.mutate,
    deactivateSede: deactivateSedeMutation.mutate,
    grantSedeAccess: grantSedeAccessMutation.mutate,
    revokeSedeAccess: revokeSedeAccessMutation.mutate,
    refreshUserSedes,
    
    // Estados de mutations
    isCreating: createSedeMutation.isPending,
    isUpdating: updateSedeMutation.isPending,
    isDeactivating: deactivateSedeMutation.isPending,
    isGrantingAccess: grantSedeAccessMutation.isPending,
    isRevokingAccess: revokeSedeAccessMutation.isPending,
  };
};

// Hook específico para obtener el ID de la sede activa
export const useActiveSedeId = () => {
  const { getActiveSedeId } = useSede();
  return getActiveSedeId();
};

// Hook para verificar acceso a sede
export const useSedeAccess = (sedeId: string) => {
  const { hasAccessToSede } = useSede();
  return hasAccessToSede(sedeId);
};