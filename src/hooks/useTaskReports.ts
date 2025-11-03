import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskReportsStorageService } from '@/services/storage/taskReportsStorage';
import { TaskReport, CreateTaskReportData, TaskMedia } from '@/types/taskReports';
import { useToast } from '@/hooks/use-toast';
import { useSede } from '@/contexts/SedeContext';
import { useCacheInvalidation } from './useCacheInvalidation';

export const useTaskReports = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeSede } = useSede();
  const { invalidateReports } = useCacheInvalidation();

  // Query para obtener todos los reportes con cache por sede
  const {
    data: reports = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['task-reports', activeSede?.id || 'no-sede'],
    queryFn: async () => {
      return await taskReportsStorageService.getTaskReports();
    },
    staleTime: 0, // Deshabilitar cache temporalmente
    gcTime: 0, // Deshabilitar cache temporalmente
    refetchOnWindowFocus: true,
    refetchInterval: false,
  });

  // Mutation para crear reporte
  const createReportMutation = useMutation({
    mutationFn: (data: CreateTaskReportData) => {
      console.log('Creating task report with data:', data);
      return taskReportsStorageService.createTaskReport(data);
    },
    onSuccess: (data, variables) => {
      console.log('Task report created successfully:', data);
      invalidateReports();
      toast({
        title: "Reporte creado",
        description: "El reporte de tarea se ha creado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error creating report:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el reporte. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Mutation para actualizar reporte
  const updateReportMutation = useMutation({
    mutationFn: ({ reportId, updates, silent = false }: { reportId: string; updates: Partial<TaskReport>; silent?: boolean }) => {
      console.log('Updating task report:', reportId, updates);
      return taskReportsStorageService.updateTaskReport(reportId, updates);
    },
    onSuccess: (data, variables) => {
      console.log('Task report updated successfully:', data);
      invalidateReports();
      
      // Solo mostrar toast si no es silent (autoguardado)
      if (!variables.silent) {
        toast({
          title: "Reporte actualizado",
          description: "El reporte se ha actualizado exitosamente.",
        });
      }
    },
    onError: (error) => {
      console.error('Error updating report:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el reporte. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Mutation para subir media
  const uploadMediaMutation = useMutation({
    mutationFn: ({ file, reportId, checklistItemId }: {
      file: File;
      reportId: string;
      checklistItemId?: string;
    }) => taskReportsStorageService.uploadMedia(file, reportId, checklistItemId),
    onSuccess: (data, variables) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['task-media', variables.reportId] });
      toast({
        title: "Archivo subido",
        description: "El archivo se ha subido exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error uploading media:', error);
      toast({
        title: "Error",
        description: "No se pudo subir el archivo. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  return {
    reports,
    isLoading,
    error,
    createReport: createReportMutation.mutate,
    updateReport: updateReportMutation.mutate,
    uploadMedia: uploadMediaMutation.mutate,
    uploadMediaAsync: uploadMediaMutation.mutateAsync,
    isCreatingReport: createReportMutation.isPending,
    isUpdatingReport: updateReportMutation.isPending,
    isUploadingMedia: uploadMediaMutation.isPending,
  };
};

// Hook específico para obtener reporte por tarea
export const useTaskReport = (taskId: string) => {
  // Para tareas virtuales (con _assignment_), usar el originalTaskId
  const actualTaskId = taskId?.includes('_assignment_') 
    ? taskId.split('_assignment_')[0] 
    : taskId;

  return useQuery({
    queryKey: ['task-report', actualTaskId],
    queryFn: () => taskReportsStorageService.getTaskReportByTaskId(actualTaskId),
    enabled: !!actualTaskId && actualTaskId !== 'undefined',
  });
};

// Hook para obtener plantillas de checklist
export const useChecklistTemplates = () => {
  return useQuery({
    queryKey: ['checklist-templates'],
    queryFn: taskReportsStorageService.getChecklistTemplates,
  });
};

// Hook para obtener media de un reporte
export const useTaskMedia = (reportId: string) => {
  return useQuery({
    queryKey: ['task-media', reportId],
    queryFn: () => taskReportsStorageService.getTaskMedia(reportId),
    enabled: !!reportId,
  });
};