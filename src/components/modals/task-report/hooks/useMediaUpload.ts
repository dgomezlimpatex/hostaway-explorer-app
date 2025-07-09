import { useState } from 'react';
import { useTaskReports } from '@/hooks/useTaskReports';
import { useToast } from '@/hooks/use-toast';

interface UseMediaUploadProps {
  reportId?: string;
  checklistItemId?: string;
  onMediaCaptured: (mediaUrl: string) => void;
  existingMediaCount: number;
}

export const useMediaUpload = ({
  reportId,
  checklistItemId,
  onMediaCaptured,
  existingMediaCount,
}: UseMediaUploadProps) => {
  const { uploadMediaAsync, isUploadingMedia } = useTaskReports();
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  const validateFile = (file: File): boolean => {
    // Validar tipo de archivo
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos de imagen o video.",
        variant: "destructive",
      });
      return false;
    }

    // Validar tamaño (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "Error", 
        description: "El archivo es demasiado grande. Máximo 50MB.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const uploadSingleFile = async (file: File) => {
    if (!file || !reportId || !validateFile(file)) return;

    // Crear preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    try {
      console.log('MediaUpload - attempting upload:', { file: file.name, reportId, checklistItemId });
      const data = await uploadMediaAsync({
        file,
        reportId,
        checklistItemId,
      });
      console.log('MediaUpload - upload successful:', data);
      onMediaCaptured(data.file_url);
      setPreviewUrl(null);
      toast({
        title: "Archivo subido",
        description: "El archivo se ha subido correctamente.",
      });
    } catch (error) {
      console.error('MediaUpload - upload failed:', error);
      setPreviewUrl(null);
      toast({
        title: "Error al subir archivo",
        description: "No se pudo subir el archivo. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  const uploadMultipleFiles = async (files: FileList) => {
    if (!files || files.length === 0 || !reportId) return;

    // Verificar límite de archivos (15 máximo + archivos existentes)
    const totalFiles = existingMediaCount + files.length;
    if (totalFiles > 15) {
      toast({
        title: "Error",
        description: `Puedes subir máximo 15 archivos. Ya tienes ${existingMediaCount} archivo(s).`,
        variant: "destructive",
      });
      return;
    }

    setUploadingCount(files.length);
    let successCount = 0;
    let errorCount = 0;

    // Subir archivos uno por uno
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!validateFile(file)) {
        errorCount++;
        continue;
      }

      try {
        console.log('MediaUpload - uploading multiple file:', { file: file.name, reportId, checklistItemId });
        const data = await uploadMediaAsync({
          file,
          reportId,
          checklistItemId,
        });
        console.log('MediaUpload - multiple upload successful:', data);
        onMediaCaptured(data.file_url);
        successCount++;
      } catch (error) {
        console.error('MediaUpload - multiple upload failed:', error);
        errorCount++;
      }
    }

    setUploadingCount(0);
    
    // Mostrar resultado
    if (successCount > 0) {
      toast({
        title: "Archivos subidos",
        description: `${successCount} archivo(s) subido(s) correctamente.${errorCount > 0 ? ` ${errorCount} archivo(s) fallaron.` : ''}`,
      });
    } else if (errorCount > 0) {
      toast({
        title: "Error al subir archivos",
        description: "No se pudo subir ningún archivo. Verifica el formato y tamaño.",
        variant: "destructive",
      });
    }
  };

  return {
    uploadSingleFile,
    uploadMultipleFiles,
    isUploadingMedia,
    uploadingCount,
    previewUrl,
  };
};