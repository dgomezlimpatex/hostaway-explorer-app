import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientStorage } from '@/services/storage/clientStorage';
import { CreateClientData } from '@/types/client';
import { toast } from '@/hooks/use-toast';
import { useSede } from '@/contexts/SedeContext';
import { useCacheInvalidation } from './useCacheInvalidation';
import { DeleteNotAppliedError } from '@/services/storage/baseStorage';
import { ClientDeletionBlockedError, evaluateClientDeletion } from '@/components/clients/clientRules';

export const useClients = () => {
  const { activeSede, isInitialized, loading } = useSede();
  
  return useQuery({
    queryKey: ['clients', activeSede?.id || 'pending-sede'],
    queryFn: () => clientStorage.getAll(),
    enabled: isInitialized && !loading && !!activeSede?.id,
  });
};

export const useClient = (id: string) => {
  const { activeSede } = useSede();
  
  return useQuery({
    queryKey: ['client', id, activeSede?.id || 'all'],
    queryFn: () => clientStorage.getById(id),
    enabled: !!id && !!activeSede?.id,
  });
};

export const useCreateClient = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();
  const { invalidateClients } = useCacheInvalidation();

  return useMutation({
    mutationFn: async (clientData: CreateClientData) => {
      return await clientStorage.create(clientData);
    },
    onSuccess: () => {
      invalidateClients();
      toast({
        title: "Cliente creado",
        description: "El cliente ha sido creado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Create client error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al crear el cliente.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateClient = () => {
  const { invalidateClients } = useCacheInvalidation();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreateClientData>; successTitle?: string }) => {
      const result = await clientStorage.update(id, updates);
      if (!result) throw new Error('No se ha guardado: el cliente ya no existe o no tienes permiso para modificarlo.');
      return result;
    },
    onSuccess: (_, variables) => {
      invalidateClients();
      toast({
        title: variables.successTitle || "Cliente actualizado",
        description: "Los datos del cliente han sido actualizados.",
      });
    },
    onError: (error) => {
      console.error('Update client error:', error);
      toast({
        title: "No se han guardado los cambios",
        description: error instanceof Error && error.message.startsWith('No se ha guardado') ? error.message : "Ha ocurrido un error al actualizar el cliente.",
        variant: "destructive",
      });
    },
  });
};

/** Recuento de registros relacionados (propiedades, tareas, portal, PMS...) antes de permitir borrar. */
export const useClientDeletionCheck = (clientId: string, enabled: boolean) => useQuery({
  queryKey: ['client-deletion-dependencies', clientId],
  queryFn: async () => evaluateClientDeletion(await clientStorage.getDeletionDependencies(clientId)),
  enabled: enabled && !!clientId,
  staleTime: 0,
  gcTime: 0,
});

export const useDeleteClient = () => {
  const { invalidateClients } = useCacheInvalidation();

  return useMutation({
    mutationFn: async (id: string) => {
      // Se vuelve a comprobar justo antes de borrar: nunca se envía el borrado con dependencias.
      await clientStorage.assertDeletable(id);
      const success = await clientStorage.delete(id);
      if (!success) throw new Error('Cliente no encontrado');
      return success;
    },
    onSuccess: () => {
      invalidateClients();
      toast({
        title: "Cliente eliminado",
        description: "El cliente ha sido eliminado.",
      });
    },
    onError: (error) => {
      console.error('Delete client error:', error);
      toast({
        title: "No se ha eliminado el cliente",
        description: error instanceof ClientDeletionBlockedError
          ? 'Tiene registros relacionados o no se han podido comprobar. Inactívalo en su lugar.'
          : error instanceof DeleteNotAppliedError ? error.message : "Ha ocurrido un error al eliminar el cliente.",
        variant: "destructive",
      });
    },
  });
};
