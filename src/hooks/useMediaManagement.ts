import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskMediaStorageService } from '@/services/storage/taskMediaStorage';
import { useToast } from '@/hooks/use-toast';

export const useMediaManagement = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const uploadMediaMutation = useMutation({
    mutationFn: ({ 
      file, 
      reportId, 
      checklistItemId,
      description 
    }: { 
      file: File; 
      reportId: string; 
      checklistItemId?: string;
      description?: string;
    }) => taskMediaStorageService.uploadMedia(file, reportId, checklistItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-media'] });
      queryClient.invalidateQueries({ queryKey: ['all-task-media'] });
      toast({
        title: "Archivo subido",
        description: "La evidencia se ha guardado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al subir archivo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMediaMutation = useMutation({
    mutationFn: (mediaId: string) => taskMediaStorageService.deleteMedia(mediaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-media'] });
      queryClient.invalidateQueries({ queryKey: ['all-task-media'] });
      toast({
        title: "Archivo eliminado",
        description: "La evidencia se ha eliminado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const downloadMedia = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Descarga iniciada",
        description: "El archivo se está descargando",
      });
    } catch (error) {
      toast({
        title: "Error en la descarga",
        description: "No se pudo descargar el archivo",
        variant: "destructive",
      });
    }
  };

  return {
    uploadMedia: uploadMediaMutation.mutate,
    deleteMedia: deleteMediaMutation.mutate,
    downloadMedia,
    isUploading: uploadMediaMutation.isPending,
    isDeleting: deleteMediaMutation.isPending,
  };
};