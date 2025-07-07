import { useMutation, useQueryClient } from '@tanstack/react-query';
import { incidentManagementService, IncidentUpdate } from '@/services/incidentManagement';
import { useToast } from '@/hooks/use-toast';

export const useIncidentManagement = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateIncidentMutation = useMutation({
    mutationFn: ({ 
      reportId, 
      incidentIndex, 
      updates 
    }: { 
      reportId: string; 
      incidentIndex: number; 
      updates: IncidentUpdate 
    }) => incidentManagementService.updateIncident(reportId, incidentIndex, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-reports'] });
      toast({
        title: "Incidencia actualizada",
        description: "Los cambios se han guardado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignIncidentMutation = useMutation({
    mutationFn: ({ 
      reportId, 
      incidentIndex, 
      assignedTo 
    }: { 
      reportId: string; 
      incidentIndex: number; 
      assignedTo: string 
    }) => incidentManagementService.assignIncident(reportId, incidentIndex, assignedTo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-reports'] });
      toast({
        title: "Incidencia asignada",
        description: "La incidencia ha sido asignada correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al asignar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resolveIncidentMutation = useMutation({
    mutationFn: ({ 
      reportId, 
      incidentIndex, 
      resolutionNotes, 
      resolvedBy 
    }: { 
      reportId: string; 
      incidentIndex: number; 
      resolutionNotes: string; 
      resolvedBy: string 
    }) => incidentManagementService.resolveIncident(reportId, incidentIndex, resolutionNotes, resolvedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-reports'] });
      toast({
        title: "Incidencia resuelta",
        description: "La incidencia ha sido marcada como resuelta",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al resolver",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    updateIncident: updateIncidentMutation.mutate,
    assignIncident: assignIncidentMutation.mutate,
    resolveIncident: resolveIncidentMutation.mutate,
    isUpdating: updateIncidentMutation.isPending || 
                assignIncidentMutation.isPending || 
                resolveIncidentMutation.isPending,
  };
};