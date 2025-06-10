
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientStorage } from '@/services/clientStorage';
import { CreateClientData } from '@/types/client';
import { toast } from '@/hooks/use-toast';

export const useClients = () => {
  return useQuery({
    queryKey: ['clients'],
    queryFn: () => clientStorage.getAll(),
  });
};

export const useClient = (id: string) => {
  return useQuery({
    queryKey: ['client', id],
    queryFn: () => clientStorage.getById(id),
    enabled: !!id,
  });
};

export const useCreateClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientData: CreateClientData) => {
      return await clientStorage.create(clientData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreateClientData> }) => {
      const result = await clientStorage.update(id, updates);
      if (!result) throw new Error('Cliente no encontrado');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client'] });
      toast({
        title: "Cliente actualizado",
        description: "Los datos del cliente han sido actualizados.",
      });
    },
    onError: (error) => {
      console.error('Update client error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al actualizar el cliente.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const success = await clientStorage.delete(id);
      if (!success) throw new Error('Cliente no encontrado');
      return success;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: "Cliente eliminado",
        description: "El cliente ha sido eliminado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Delete client error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al eliminar el cliente.",
        variant: "destructive",
      });
    },
  });
};
