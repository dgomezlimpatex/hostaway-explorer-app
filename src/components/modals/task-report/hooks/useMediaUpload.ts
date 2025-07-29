import { useState } from 'react';
import { useTaskReports } from '@/hooks/useTaskReports';
import { useToast } from '@/hooks/use-toast';
import { useFileUploadSecurity } from '@/hooks/useFileUploadSecurity';

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
  const { validateFile: secureValidateFile } = useFileUploadSecurity();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  const validateFile = (file: File): boolean => {
    // Use secure validation first
    const mediaType = file.type.startsWith('image/') ? 'image' : 'video';
    const secureValidation = secureValidateFile(file, mediaType);
    
    if (!secureValidation.isValid) {
      toast({
        title: "Error",
        description: secureValidation.error,
        variant: "destructive",
      });
      return false;
    }

    // Additional legacy validation for compatibility
    const fileName = file.name.toLowerCase();
    const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];
    const validVideoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    
    const hasValidExtension = [...validImageExtensions, ...validVideoExtensions].some(ext => 
      fileName.endsWith(ext)
    );

    if (!hasValidExtension) {
      toast({
        title: "Error",
        description: "Formato de archivo no soportado.",
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
    if (!files || files.length === 0 || !reportId) {
      console.log('MediaUpload - uploadMultipleFiles early return:', { files: files?.length, reportId });
      return;
    }

    console.log('MediaUpload - starting multiple upload:', { 
      fileCount: files.length, 
      reportId, 
      checklistItemId,
      existingMediaCount 
    });

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

    // Convertir FileList a Array para mejor manejo
    const filesArray = Array.from(files);
    console.log('MediaUpload - files array created:', filesArray.map(f => ({ name: f.name, size: f.size, type: f.type })));

    // Subir archivos uno por uno
    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      console.log(`MediaUpload - processing file ${i + 1}/${filesArray.length}:`, { name: file.name, size: file.size, type: file.type });
      
      if (!validateFile(file)) {
        console.log('MediaUpload - file validation failed:', file.name);
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
        console.error('MediaUpload - multiple upload failed for file:', file.name, error);
        errorCount++;
      }
    }

    console.log('MediaUpload - upload process completed:', { successCount, errorCount, total: filesArray.length });
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