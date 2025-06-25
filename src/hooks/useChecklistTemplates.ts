
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { checklistTemplatesStorageService } from '@/services/storage/taskReportsStorage';
import { TaskChecklistTemplate } from '@/types/taskReports';
import { useToast } from '@/hooks/use-toast';

export const useChecklistTemplates = () => {
  return useQuery({
    queryKey: ['checklist-templates'],
    queryFn: checklistTemplatesStorageService.getChecklistTemplates,
  });
};

export const useCreateChecklistTemplate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (templateData: Omit<TaskChecklistTemplate, 'id' | 'created_at' | 'updated_at'>) => {
      // This would call the API to create the template
      console.log('Creating template:', templateData);
      return templateData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-templates'] });
      toast({
        title: "Plantilla creada",
        description: "La plantilla de checklist se ha creado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error creating template:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la plantilla. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateChecklistTemplate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ templateId, updates }: { templateId: string; updates: Partial<TaskChecklistTemplate> }) => {
      // This would call the API to update the template
      console.log('Updating template:', templateId, updates);
      return updates;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-templates'] });
      toast({
        title: "Plantilla actualizada",
        description: "La plantilla se ha actualizado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error updating template:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la plantilla. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });
};
