
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { propertyChecklistStorageService } from '@/services/storage/propertyChecklistStorage';
import { useToast } from '@/hooks/use-toast';

export const usePropertyChecklistAssignment = (propertyId: string) => {
  return useQuery({
    queryKey: ['property-checklist', propertyId],
    queryFn: () => propertyChecklistStorageService.getPropertyChecklistAssignment(propertyId),
    enabled: !!propertyId,
  });
};

export const useAssignChecklistToProperty = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ propertyId, templateId }: { propertyId: string; templateId: string }) => {
      return await propertyChecklistStorageService.assignChecklistToProperty(propertyId, templateId);
    },
    onSuccess: (_, { propertyId }) => {
      queryClient.invalidateQueries({ queryKey: ['property-checklist', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast({
        title: "Plantilla asignada",
        description: "La plantilla se ha asignado correctamente a la propiedad.",
      });
    },
    onError: (error) => {
      console.error('Error assigning checklist:', error);
      toast({
        title: "Error",
        description: "No se pudo asignar la plantilla. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });
};

export const useRemoveChecklistFromProperty = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (propertyId: string) => {
      return await propertyChecklistStorageService.removeChecklistFromProperty(propertyId);
    },
    onSuccess: (_, propertyId) => {
      queryClient.invalidateQueries({ queryKey: ['property-checklist', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast({
        title: "Plantilla removida",
        description: "La plantilla se ha removido de la propiedad.",
      });
    },
    onError: (error) => {
      console.error('Error removing checklist:', error);
      toast({
        title: "Error",
        description: "No se pudo remover la plantilla. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });
};
