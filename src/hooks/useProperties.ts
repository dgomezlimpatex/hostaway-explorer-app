
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { propertyStorage } from '@/services/propertyStorage';
import { CreatePropertyData } from '@/types/property';
import { toast } from '@/hooks/use-toast';

export const useProperties = () => {
  return useQuery({
    queryKey: ['properties'],
    queryFn: () => propertyStorage.getAll(),
  });
};

export const useProperty = (id: string) => {
  return useQuery({
    queryKey: ['property', id],
    queryFn: () => propertyStorage.getById(id),
    enabled: !!id,
  });
};

export const usePropertiesByClient = (clienteId: string) => {
  return useQuery({
    queryKey: ['properties', 'client', clienteId],
    queryFn: () => propertyStorage.getByClientId(clienteId),
    enabled: !!clienteId,
  });
};

export const useCreateProperty = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (propertyData: CreatePropertyData) => {
      return await propertyStorage.create(propertyData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast({
        title: "Propiedad creada",
        description: "La propiedad ha sido creada exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Create property error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al crear la propiedad.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateProperty = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreatePropertyData> }) => {
      const result = await propertyStorage.update(id, updates);
      if (!result) throw new Error('Propiedad no encontrada');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property'] });
      toast({
        title: "Propiedad actualizada",
        description: "Los datos de la propiedad han sido actualizados.",
      });
    },
    onError: (error) => {
      console.error('Update property error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al actualizar la propiedad.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteProperty = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const success = await propertyStorage.delete(id);
      if (!success) throw new Error('Propiedad no encontrada');
      return success;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast({
        title: "Propiedad eliminada",
        description: "La propiedad ha sido eliminada exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Delete property error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al eliminar la propiedad.",
        variant: "destructive",
      });
    },
  });
};
