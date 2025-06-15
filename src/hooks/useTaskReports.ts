
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskReportsStorageService } from '@/services/storage/taskReportsStorage';
import { TaskReport, CreateTaskReportData, TaskMedia } from '@/types/taskReports';
import { useToast } from '@/hooks/use-toast';

export const useTaskReports = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query para obtener todos los reportes
  const {
    data: reports = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['task-reports'],
    queryFn: taskReportsStorageService.getTaskReports,
  });

  // Mutation para crear reporte
  const createReportMutation = useMutation({
    mutationFn: (data: CreateTaskReportData) => taskReportsStorageService.createTaskReport(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-reports'] });
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
    mutationFn: ({ reportId, updates }: { reportId: string; updates: Partial<TaskReport> }) =>
      taskReportsStorageService.updateTaskReport(reportId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-reports'] });
      toast({
        title: "Reporte actualizado",
        description: "El reporte se ha actualizado exitosamente.",
      });
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
    onSuccess: () => {
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
