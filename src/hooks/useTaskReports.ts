
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskReportsStorageService } from '@/services/storage/taskReportsStorage';
import { TaskReport, CreateTaskReportData, TaskMedia } from '@/types/taskReports';
import { useToast } from '@/hooks/use-toast';

export const useTaskReports = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query para obtener todos los reportes con cache agresivo
  const {
    data: reports = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['task-reports'],
    queryFn: async () => {
      console.log('🚀 useQuery queryFn executing...');
      const result = await taskReportsStorageService.getTaskReports();
      console.log('🚀 useQuery queryFn result:', result?.length || 0, 'reports');
      return result;
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
      queryClient.invalidateQueries({ queryKey: ['task-reports'] });
      queryClient.invalidateQueries({ queryKey: ['task-report', variables.task_id] });
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
      queryClient.invalidateQueries({ queryKey: ['task-reports'] });
      queryClient.invalidateQueries({ queryKey: ['task-report', data.task_id] });
      
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
  return useQuery({
    queryKey: ['task-report', taskId],
    queryFn: () => taskReportsStorageService.getTaskReportByTaskId(taskId),
    enabled: !!taskId,
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
