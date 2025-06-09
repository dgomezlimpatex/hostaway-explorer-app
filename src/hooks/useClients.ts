
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
    mutationFn: (clientData: CreateClientData) => {
      return Promise.resolve(clientStorage.create(clientData));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: "Cliente creado",
        description: "El cliente ha sido creado exitosamente.",
      });
    },
    onError: () => {
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
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CreateClientData> }) => {
      const result = clientStorage.update(id, updates);
      if (!result) throw new Error('Cliente no encontrado');
      return Promise.resolve(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client'] });
      toast({
        title: "Cliente actualizado",
        description: "Los datos del cliente han sido actualizados.",
      });
    },
    onError: () => {
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
    mutationFn: (id: string) => {
      const success = clientStorage.delete(id);
      if (!success) throw new Error('Cliente no encontrado');
      return Promise.resolve(success);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: "Cliente eliminado",
        description: "El cliente ha sido eliminado exitosamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Ha ocurrido un error al eliminar el cliente.",
        variant: "destructive",
      });
    },
  });
};
