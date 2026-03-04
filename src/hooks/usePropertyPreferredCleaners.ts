import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { propertyPreferredCleanersStorage } from '@/services/storage/propertyPreferredCleanersStorage';
import { useToast } from '@/hooks/use-toast';

export const usePreferredCleaners = (propertyId: string | undefined) => {
  return useQuery({
    queryKey: ['property-preferred-cleaners', propertyId],
    queryFn: () => propertyPreferredCleanersStorage.getByPropertyId(propertyId!),
    enabled: !!propertyId,
  });
};

export const usePreferredCleanersByPropertyName = (propertyName: string | undefined) => {
  return useQuery({
    queryKey: ['property-preferred-cleaners-by-name', propertyName],
    queryFn: () => propertyPreferredCleanersStorage.getPreferredCleanerIdsByPropertyName(propertyName!),
    enabled: !!propertyName,
  });
};

export const useAssignPreferredCleaner = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ propertyId, cleanerId, priority, notes }: { propertyId: string; cleanerId: string; priority?: number; notes?: string }) =>
      propertyPreferredCleanersStorage.assign(propertyId, cleanerId, priority, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-preferred-cleaners'] });
      toast({ title: 'Limpiadora preferida añadida' });
    },
    onError: () => {
      toast({ title: 'Error al añadir limpiadora preferida', variant: 'destructive' });
    },
  });
};

export const useRemovePreferredCleaner = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => propertyPreferredCleanersStorage.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-preferred-cleaners'] });
      toast({ title: 'Limpiadora preferida eliminada' });
    },
    onError: () => {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    },
  });
};
