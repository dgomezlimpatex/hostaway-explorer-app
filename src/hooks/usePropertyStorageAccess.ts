import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { propertyStorageAccessStorage } from '@/services/storage/propertyStorageAccessStorage';
import type { PropertyStorageAccessRow, PropertyStorageAccessType } from '@/features/stock/propertyStorageAccess';

export const propertyStorageAccessQueryKey = (propertyGroupId?: string) => [
  'property-storage-access',
  propertyGroupId || 'none',
] as const;

export const usePropertyStorageAccess = (propertyGroupId?: string) => useQuery({
  queryKey: propertyStorageAccessQueryKey(propertyGroupId),
  queryFn: () => propertyStorageAccessStorage.getByBuilding(propertyGroupId!),
  enabled: Boolean(propertyGroupId),
  staleTime: 30_000,
});

export const useSetPropertyStorageAccess = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      propertyId: string;
      propertyGroupId: string;
      accessType: PropertyStorageAccessType;
      warehouseId?: string | null;
      notes?: string | null;
    }) => propertyStorageAccessStorage.setAccess(input),
    onSuccess: (row: PropertyStorageAccessRow) => {
      queryClient.invalidateQueries({ queryKey: propertyStorageAccessQueryKey(row.propertyGroupId) });
      toast({
        title: 'Acceso al trastero actualizado',
        description: row.accessType === 'shared'
          ? 'La propiedad utiliza el trastero físico del edificio.'
          : 'La propiedad queda marcada sin acceso a trastero.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo guardar el acceso al trastero',
        description: error instanceof Error ? error.message : 'Comprueba el edificio y el almacén seleccionado.',
        variant: 'destructive',
      });
    },
  });
};
