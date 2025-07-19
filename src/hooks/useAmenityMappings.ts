import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { amenityMappingStorage, type AmenityMapping, type CreateAmenityMapping } from '@/services/storage/amenityMappingStorage';
import { useToast } from '@/hooks/use-toast';

export function useAmenityMappings() {
  return useQuery({
    queryKey: ['amenity-mappings'],
    queryFn: () => amenityMappingStorage.getAmenityMappings(),
  });
}

export function useCreateAmenityMapping() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (mapping: CreateAmenityMapping) => 
      amenityMappingStorage.createAmenityMapping(mapping),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amenity-mappings'] });
      toast({
        title: "Mapeo creado",
        description: "El mapeo de amenity ha sido creado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error creating amenity mapping:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el mapeo. Intenta nuevamente.",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateAmenityMapping() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, mapping }: { id: string; mapping: Partial<CreateAmenityMapping> }) =>
      amenityMappingStorage.updateAmenityMapping(id, mapping),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amenity-mappings'] });
      toast({
        title: "Mapeo actualizado",
        description: "El mapeo de amenity ha sido actualizado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error updating amenity mapping:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el mapeo. Intenta nuevamente.",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteAmenityMapping() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => amenityMappingStorage.deleteAmenityMapping(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amenity-mappings'] });
      toast({
        title: "Mapeo eliminado",
        description: "El mapeo de amenity ha sido eliminado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error deleting amenity mapping:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el mapeo. Intenta nuevamente.",
        variant: "destructive",
      });
    },
  });
}

export function useProcessAutomaticConsumption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, propertyId }: { taskId: string; propertyId: string }) =>
      amenityMappingStorage.processAutomaticConsumption(taskId, propertyId),
    onSuccess: () => {
      // Invalidar queries relacionadas con inventario
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
    },
    onError: (error) => {
      console.error('Error processing automatic consumption:', error);
    },
  });
}