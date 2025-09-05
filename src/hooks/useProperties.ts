import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { propertyStorage } from '@/services/storage/propertyStorage';
import { CreatePropertyData } from '@/types/property';
import { toast } from '@/hooks/use-toast';
import { useSede } from '@/contexts/SedeContext';
import { useCacheInvalidation } from './useCacheInvalidation';

export const useProperties = () => {
  const { activeSede } = useSede();
  
  return useQuery({
    queryKey: ['properties', activeSede?.id || 'all'],
    queryFn: () => propertyStorage.getAll(),
    enabled: true, // Always enabled - remove sede dependency temporarily
  });
};

export const useProperty = (id: string) => {
  const { activeSede } = useSede();
  
  return useQuery({
    queryKey: ['property', id, activeSede?.id || 'all'],
    queryFn: () => propertyStorage.getById(id),
    enabled: !!id, // Only depend on id, not sede
  });
};

export const usePropertiesByClient = (clienteId: string) => {
  const { activeSede } = useSede();
  
  return useQuery({
    queryKey: ['properties', 'client', clienteId, activeSede?.id || 'all'],
    queryFn: () => propertyStorage.getByClientId(clienteId),
    enabled: !!clienteId, // Only depend on clienteId, not sede
  });
};

export const useCreateProperty = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();
  const { invalidateProperties } = useCacheInvalidation();

  return useMutation({
    mutationFn: async (propertyData: CreatePropertyData) => {
      return await propertyStorage.create(propertyData);
    },
    onSuccess: () => {
      invalidateProperties();
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
  const { activeSede } = useSede();
  const { invalidateProperties } = useCacheInvalidation();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreatePropertyData> }) => {
      const result = await propertyStorage.update(id, updates);
      if (!result) throw new Error('Propiedad no encontrada');
      return result;
    },
    onSuccess: () => {
      invalidateProperties();
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
  const { activeSede } = useSede();
  const { invalidateProperties } = useCacheInvalidation();

  return useMutation({
    mutationFn: async (id: string) => {
      const success = await propertyStorage.delete(id);
      if (!success) throw new Error('Propiedad no encontrada');
      return success;
    },
    onSuccess: () => {
      invalidateProperties();
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