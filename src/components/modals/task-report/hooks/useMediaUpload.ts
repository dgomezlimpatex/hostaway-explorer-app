import { useState, useCallback } from 'react';
import { useTaskReports } from '@/hooks/useTaskReports';
import { useToast } from '@/hooks/use-toast';
import { useFileUploadSecurity } from '@/hooks/useFileUploadSecurity';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useDeviceType } from '@/hooks/use-mobile';
import { compressImage, shouldCompressImage } from '@/utils/imageCompression';
import { offlineStorage } from '@/utils/offlineStorage';

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
  const { isOnline, isSlowConnection } = useNetworkStatus();
  const { isMobile } = useDeviceType();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);

  const validateFile = (file: File): boolean => {
    console.log('🔍 VALIDANDO ARCHIVO:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      sizeMB: Math.round(file.size / (1024 * 1024) * 100) / 100
    });

    // Validación básica más permisiva
    if (!file || !file.name) {
      console.error('❌ Archivo inválido o sin nombre');
      toast({
        title: "Error",
        description: "Archivo no válido",
        variant: "destructive",
      });
      return false;
    }

    // Verificar tamaño primero (100MB máximo)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      console.error('❌ Archivo muy grande:', file.size, 'bytes');
      toast({
        title: "Error",
        description: `Archivo muy grande. Máximo 100MB (tu archivo: ${Math.round(file.size / (1024 * 1024))}MB)`,
        variant: "destructive",
      });
      return false;
    }

    if (file.size === 0) {
      console.error('❌ Archivo vacío');
      toast({
        title: "Error",
        description: "El archivo está vacío",
        variant: "destructive",
      });
      return false;
    }

    // Lista muy amplia de extensiones válidas
    const fileName = file.name.toLowerCase();
    const validExtensions = [
      // Imágenes básicas
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
      // Formatos Apple/iOS
      '.heic', '.heif', 
      // Formatos RAW
      '.dng', '.raw', '.cr2', '.crw', '.nef', '.arw', '.orf', '.rw2', '.pef', '.srw',
      // Otros formatos
      '.tiff', '.tif', '.avif', '.jfif',
      // Videos
      '.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.m4v', '.3gp'
    ];
    
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
      console.error('❌ Extensión no válida:', fileName);
      toast({
        title: "Error",
        description: `Formato no soportado. Tu archivo: ${fileName}. Formatos válidos: JPG, PNG, HEIC, etc.`,
        variant: "destructive",
      });
      return false;
    }

    // Si llegamos aquí, el archivo es válido
    console.log('✅ Archivo válido para subida');
    return true;
  };

  // Función para comprimir archivo antes de subir
  const prepareFileForUpload = useCallback(async (file: File): Promise<File> => {
    if (!shouldCompressImage(file)) {
      return file;
    }

    try {
      const compressionOptions = isMobile ? {
        maxWidth: 1280,
        maxHeight: 720,
        quality: isSlowConnection ? 0.6 : 0.8,
        maxSizeKB: isSlowConnection ? 512 : 1024
      } : {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.8,
        maxSizeKB: 1024
      };

      const compressedFile = await compressImage(file, compressionOptions);
      console.log('File compressed:', { 
        original: file.size, 
        compressed: compressedFile.size, 
        reduction: Math.round((1 - compressedFile.size / file.size) * 100) + '%' 
      });
      return compressedFile;
    } catch (error) {
      console.error('Error compressing file:', error);
      return file; // Fallback al archivo original
    }
  }, [isMobile, isSlowConnection]);

  const uploadSingleFile = async (file: File) => {
    if (!file || !reportId || !validateFile(file)) return;

    // Crear preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    try {
      // Preparar archivo (comprimir si es necesario)
      const preparedFile = await prepareFileForUpload(file);
      
      // Verificar conectividad
      if (!isOnline) {
        // Guardar para upload posterior
        offlineStorage.addOperation('uploadMedia', {
          file: preparedFile,
          reportId,
          checklistItemId,
        });
        
        // Crear URL local temporal para preview
        onMediaCaptured(url);
        setPreviewUrl(null);
        
        toast({
          title: "Archivo guardado offline",
          description: "Se subirá cuando haya conexión.",
        });
        return;
      }

      console.log('📱 MediaUpload - attempting upload:', { 
        file: preparedFile.name, 
        size: preparedFile.size,
        type: preparedFile.type,
        reportId, 
        checklistItemId,
        isOnline 
      });
      
      const data = await uploadMediaAsync({
        file: preparedFile,
        reportId,
        checklistItemId,
      });
      
      console.log('✅ MediaUpload - upload successful:', data);
      onMediaCaptured(data.file_url);
      setPreviewUrl(null);
      
      toast({
        title: "Archivo subido",
        description: "El archivo se ha subido correctamente.",
      });
    } catch (error) {
      console.error('❌ MediaUpload - upload failed:', error);
      setPreviewUrl(null);
      
      // Error más descriptivo
      let errorMessage = "No se pudo subir el archivo.";
      if (error instanceof Error) {
        if (error.message.includes('413') || error.message.includes('too large')) {
          errorMessage = "El archivo es muy grande. Máximo 100MB.";
        } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
          errorMessage = "No tienes permisos para subir archivos.";
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = "Error de conexión. Verifica tu internet.";
        } else if (error.message.includes('quota') || error.message.includes('storage')) {
          errorMessage = "Espacio de almacenamiento lleno.";
        }
      }
      
      toast({
        title: "Error al subir archivo",
        description: errorMessage + " Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  // Upload en batch optimizado para móvil
  const uploadMultipleFiles = async (files: FileList) => {
    if (!files || files.length === 0 || !reportId) {
      console.log('MediaUpload - uploadMultipleFiles early return:', { files: files?.length, reportId });
      return;
    }

    console.log('MediaUpload - starting optimized multiple upload:', { 
      fileCount: files.length, 
      reportId, 
      checklistItemId,
      existingMediaCount,
      isOnline,
      isMobile 
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

    const filesArray = Array.from(files);
    setUploadingCount(filesArray.length);
    
    let successCount = 0;
    let errorCount = 0;
    let offlineCount = 0;

    // Preparar archivos en paralelo (comprimir)
    const preparedFiles = await Promise.allSettled(
      filesArray.map(async (file) => {
        if (!validateFile(file)) {
          throw new Error(`Archivo ${file.name} no válido`);
        }
        return prepareFileForUpload(file);
      })
    );

    console.log('MediaUpload - files prepared:', preparedFiles.length);

    // Configurar concurrencia basada en dispositivo y conexión
    const concurrencyLimit = isMobile && isSlowConnection ? 1 : (isMobile ? 2 : 3);
    
    // Procesar uploads en lotes
    for (let i = 0; i < preparedFiles.length; i += concurrencyLimit) {
      const batch = preparedFiles.slice(i, i + concurrencyLimit);
      
      await Promise.allSettled(
        batch.map(async (result, batchIndex) => {
          if (result.status === 'rejected') {
            console.error('File preparation failed:', result.reason);
            errorCount++;
            return;
          }

          const file = result.value;
          const originalIndex = i + batchIndex;
          
          try {
            if (!isOnline) {
              // Guardar offline
              offlineStorage.addOperation('uploadMedia', {
                file,
                reportId,
                checklistItemId,
              });
              
              // Crear preview temporal
              const url = URL.createObjectURL(file);
              onMediaCaptured(url);
              offlineCount++;
            } else {
              const data = await uploadMediaAsync({
                file,
                reportId,
                checklistItemId,
              });
              
              console.log(`MediaUpload - batch upload ${originalIndex + 1} successful:`, data);
              onMediaCaptured(data.file_url);
              successCount++;
            }
          } catch (error) {
            console.error(`MediaUpload - batch upload ${originalIndex + 1} failed:`, error);
            errorCount++;
          }
        })
      );

      // Pequeña pausa entre lotes para no saturar en móvil
      if (isMobile && i + concurrencyLimit < preparedFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log('MediaUpload - batch upload process completed:', { 
      successCount, 
      errorCount, 
      offlineCount, 
      total: filesArray.length 
    });
    
    setUploadingCount(0);
    
    // Mostrar resultado
    if (offlineCount > 0) {
      toast({
        title: "Archivos guardados offline",
        description: `${offlineCount} archivo(s) se subirán cuando haya conexión.`,
      });
    } else if (successCount > 0) {
      toast({
        title: "Archivos subidos",
        description: `${successCount} archivo(s) subido(s) correctamente.${errorCount > 0 ? ` ${errorCount} fallaron.` : ''}`,
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
    isUploadingMedia: isUploadingMedia || uploadingCount > 0,
    uploadingCount,
    previewUrl,
    isOnline,
    isSlowConnection,
  };
};