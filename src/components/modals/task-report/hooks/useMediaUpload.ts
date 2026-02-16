import { useState, useCallback, useEffect } from 'react';
import { useTaskReports } from '@/hooks/useTaskReports';
import { useToast } from '@/hooks/use-toast';
import { useFileUploadSecurity } from '@/hooks/useFileUploadSecurity';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useDeviceType } from '@/hooks/use-mobile';
import { compressImage, shouldCompressImage, getMimeType } from '@/utils/imageCompression';
import { offlineStorage } from '@/utils/offlineStorage';
import { useMediaCleanup } from '@/utils/mediaCleanup';
import { useQueryClient } from '@tanstack/react-query';

interface UseMediaUploadProps {
  reportId?: string;
  checklistItemId?: string;
  onMediaCaptured: (mediaUrl: string) => void;
  onUploadError?: (error: string | Error, context?: any, userAction?: string) => void;
  existingMediaCount: number;
}

export const useMediaUpload = ({
  reportId,
  checklistItemId,
  onMediaCaptured,
  onUploadError,
  existingMediaCount,
}: UseMediaUploadProps) => {
  const { uploadMediaAsync, isUploadingMedia } = useTaskReports();
  const { toast } = useToast();
  const { validateFile: secureValidateFile } = useFileUploadSecurity();
  const { isOnline, isSlowConnection } = useNetworkStatus();
  const { isMobile } = useDeviceType();
  const { registerUrl, revokeUrl, revokeAll } = useMediaCleanup();
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadAttempts, setUploadAttempts] = useState<Map<string, number>>(new Map());

  // CRITICAL FIX: Limpieza automática al desmontar componente
  useEffect(() => {
    return () => {
      console.log('🧹 useMediaUpload: Cleaning up on unmount');
      revokeAll(); // Limpiar todas las URLs registradas
    };
  }, [revokeAll]);

  const validateFile = (file: File): { isValid: boolean; error?: string } => {
    console.log('🔍 VALIDANDO ARCHIVO:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      sizeMB: Math.round(file.size / (1024 * 1024) * 100) / 100
    });

    // Validación básica robusta
    if (!file || !file.name) {
      return { isValid: false, error: "Archivo no válido" };
    }

    // Verificar que no está corrupto
    if (file.size === 0) {
      return { isValid: false, error: "El archivo está vacío" };
    }

    // Tamaño máximo más generoso (200MB)
    const maxSize = 200 * 1024 * 1024;
    if (file.size > maxSize) {
      return { 
        isValid: false, 
        error: `Archivo muy grande. Máximo 200MB (tu archivo: ${Math.round(file.size / (1024 * 1024))}MB)` 
      };
    }

    // Lista ampliada de extensiones válidas para móvil
    const fileName = file.name.toLowerCase();
    const validExtensions = [
      // Imágenes estándar
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif',
      // Formatos Apple/iOS (críticos para móvil)
      '.heic', '.heif', '.heics',
      // Formatos RAW (para cámaras profesionales)
      '.dng', '.raw', '.cr2', '.crw', '.nef', '.arw', '.orf', '.rw2', '.pef', '.srw',
      // Otros formatos de imagen
      '.tiff', '.tif', '.jfif', '.jpe', '.jfi',
      // Videos (ampliado para móvil)
      '.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.m4v', '.3gp', '.3g2', '.f4v', '.flv'
    ];
    
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
      return { 
        isValid: false, 
        error: `Formato no soportado. Archivo: ${fileName}. Formatos válidos: JPG, PNG, HEIC, MP4, MOV, etc.` 
      };
    }

    // Validación adicional de tipo MIME más flexible
    if (file.type && !file.type.match(/^(image|video)\//)) {
      // Solo advertir, no bloquear (algunos dispositivos no reportan MIME correctamente)
      console.warn('⚠️ MIME type unusual but proceeding:', file.type);
    }

    console.log('✅ Archivo válido para subida');
    return { isValid: true };
  };

  // Función mejorada para comprimir archivo antes de subir
  const prepareFileForUpload = useCallback(async (file: File): Promise<File> => {
    if (!shouldCompressImage(file)) {
      return file;
    }

    try {
      // Configuración de compresión adaptativa
      const compressionOptions = isMobile ? {
        maxWidth: isSlowConnection ? 1024 : 1280,
        maxHeight: isSlowConnection ? 768 : 720,
        quality: isSlowConnection ? 0.5 : 0.7,
        maxSizeKB: isSlowConnection ? 400 : 800
      } : {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.8,
        maxSizeKB: 1024
      };

      const compressedFile = await compressImage(file, compressionOptions);
      const reduction = Math.round((1 - compressedFile.size / file.size) * 100);
      
      console.log('📷 File compressed:', { 
        original: `${Math.round(file.size / 1024)}KB`,
        compressed: `${Math.round(compressedFile.size / 1024)}KB`,
        reduction: `${reduction}%`
      });
      
      return compressedFile;
    } catch (error) {
      console.error('❌ Error compressing file:', error);
      return file; // Fallback al archivo original
    }
  }, [isMobile, isSlowConnection]);

  const uploadSingleFile = async (file: File) => {
    if (!file) {
      console.warn('⚠️ No file provided');
      return;
    }
    
    if (!reportId) {
      console.error('❌ CRITICAL: No reportId available - upload cannot proceed');
      toast({
        title: "Error al subir",
        description: "El reporte aún no se ha creado. Espera un momento e inténtalo de nuevo.",
        variant: "destructive",
      });
      return;
    }

    const validation = validateFile(file);
    if (!validation.isValid) {
      const errorMsg = validation.error || 'Archivo no válido';
      onUploadError?.(errorMsg, { 
        fileName: file.name, 
        fileSize: file.size,
        reportId,
        checklistItemId 
      }, 'Intentando subir foto desde cámara');
      
      toast({
        title: "Error de validación",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    // CRITICAL FIX: Crear preview con limpieza automática de memoria
    const url = URL.createObjectURL(file);
    registerUrl(url, 300000); // Auto-cleanup en 5 min
    setPreviewUrl(url);

    // Verificar intentos previos para este archivo
    const fileKey = `${file.name}_${file.size}_${file.lastModified}`;
    const attempts = uploadAttempts.get(fileKey) || 0;
    
    if (attempts >= 3) {
      const errorMsg = 'Este archivo ha fallado 3 veces. Por favor, intenta con otro archivo.';
      onUploadError?.(errorMsg, {
        fileName: file.name,
        fileSize: file.size,
        attempts: attempts,
        reportId,
        checklistItemId
      }, 'Reintentando subir archivo después de 3 fallos');
      
      toast({
        title: "Máximo de intentos alcanzado",
        description: errorMsg,
        variant: "destructive",
      });
      setPreviewUrl(null);
      return;
    }

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
          description: "Se subirá automáticamente cuando tengas conexión.",
        });
        return;
      }

      console.log('📱 MediaUpload - attempting upload:', { 
        file: preparedFile.name, 
        size: preparedFile.size,
        type: preparedFile.type,
        reportId, 
        checklistItemId,
        isOnline,
        attempt: attempts + 1
      });
      
      const data = await uploadMediaAsync({
        file: preparedFile,
        reportId,
        checklistItemId,
      });
      
      console.log('✅ CRITICAL: MediaUpload - upload successful:', {
        data,
        fileName: preparedFile.name,
        reportId,
        checklistItemId
      });
      
      onMediaCaptured(data.file_url);
      
      // CRITICAL FIX: Limpiar preview URL y invalidar cache correctamente
      if (previewUrl) {
        revokeUrl(previewUrl);
      }
      setPreviewUrl(null);
      
      // CRITICAL: Invalidar cache para que el dashboard se actualice inmediatamente
      queryClient.invalidateQueries({ queryKey: ['task-media'] });
      queryClient.invalidateQueries({ queryKey: ['all-task-media'] });
      queryClient.invalidateQueries({ queryKey: ['task-reports'] });
      
      // Reset attempts counter on success
      setUploadAttempts(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileKey);
        return newMap;
      });
      
      toast({
        title: "Archivo subido exitosamente",
        description: "La evidencia se ha guardado correctamente.",
      });
    } catch (error) {
      console.error('❌ CRITICAL: MediaUpload - upload failed:', {
        error,
        fileName: file.name,
        fileSize: file.size,
        reportId,
        checklistItemId,
        attempt: attempts + 1
      });
      
      // CRITICAL FIX: Limpiar preview URL para evitar UI en blanco
      if (previewUrl) {
        revokeUrl(previewUrl);
      }
      setPreviewUrl(null);
      
      // Incrementar contador de intentos
      setUploadAttempts(prev => {
        const newMap = new Map(prev);
        newMap.set(fileKey, attempts + 1);
        return newMap;
      });
      
      // CRÍTICO: Reportar error a sistema móvil
      onUploadError?.(error, {
        fileName: file.name,
        fileSize: file.size,
        reportId,
        checklistItemId,
        attempt: attempts + 1,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        isOnline: navigator.onLine
      }, 'Subiendo foto desde cámara');
      
      // Error más descriptivo y específico
      let errorMessage = "No se pudo subir el archivo.";
      let shouldRetry = true;
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('413') || errorMsg.includes('too large') || errorMsg.includes('payload')) {
          errorMessage = "Archivo demasiado grande. Intenta con un archivo más pequeño.";
          shouldRetry = false;
        } else if (errorMsg.includes('401') || errorMsg.includes('unauthorized') || errorMsg.includes('forbidden')) {
          errorMessage = "Sin permisos. Verifica tu sesión e inténtalo de nuevo.";
          shouldRetry = false;
        } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('timeout')) {
          errorMessage = "Problema de conexión. Verifica tu internet.";
        } else if (errorMsg.includes('quota') || errorMsg.includes('storage') || errorMsg.includes('space')) {
          errorMessage = "Espacio de almacenamiento insuficiente.";
          shouldRetry = false;
        } else if (errorMsg.includes('format') || errorMsg.includes('type') || errorMsg.includes('invalid')) {
          errorMessage = "Formato de archivo no compatible.";
          shouldRetry = false;
        }
      }
      
      const remainingAttempts = shouldRetry ? (3 - attempts - 1) : 0;
      const description = shouldRetry && remainingAttempts > 0 
        ? `${errorMessage} (${remainingAttempts} intentos restantes)`
        : errorMessage;
      
      toast({
        title: "Error al subir archivo",
        description: description,
        variant: "destructive",
      });
    }
  };

  // Upload en lotes optimizado y robusto
  const uploadMultipleFiles = async (files: FileList) => {
    if (!files || files.length === 0) {
      console.log('MediaUpload - uploadMultipleFiles early return: no files');
      return;
    }
    
    if (!reportId) {
      console.error('❌ CRITICAL: No reportId available - batch upload cannot proceed');
      toast({
        title: "Error al subir",
        description: "El reporte aún no se ha creado. Espera un momento e inténtalo de nuevo.",
        variant: "destructive",
      });
      return;
    }

    console.log('MediaUpload - starting robust multiple upload:', { 
      fileCount: files.length, 
      reportId, 
      checklistItemId,
      existingMediaCount,
      isOnline,
      isMobile 
    });

    // Verificar límite de archivos (20 máximo + archivos existentes)
    const totalFiles = existingMediaCount + files.length;
    if (totalFiles > 20) {
      toast({
        title: "Límite de archivos excedido",
        description: `Puedes tener máximo 20 archivos. Ya tienes ${existingMediaCount} archivo(s).`,
        variant: "destructive",
      });
      return;
    }

    const filesArray = Array.from(files);
    
    // Validar todos los archivos primero
    const validFiles: File[] = [];
    for (const file of filesArray) {
      const validation = validateFile(file);
      if (validation.isValid) {
        validFiles.push(file);
      } else {
        console.warn(`⚠️ Archivo inválido omitido: ${file.name} - ${validation.error}`);
        toast({
          title: "Archivo omitido",
          description: `${file.name}: ${validation.error}`,
          variant: "destructive",
        });
      }
    }

    if (validFiles.length === 0) {
      toast({
        title: "Sin archivos válidos",
        description: "Todos los archivos seleccionados tienen problemas.",
        variant: "destructive",
      });
      return;
    }

    setUploadingCount(validFiles.length);
    
    let successCount = 0;
    let errorCount = 0;
    let offlineCount = 0;

    // Preparar archivos en paralelo (comprimir)
    const preparePromises = validFiles.map(async (file, index) => {
      try {
        const preparedFile = await prepareFileForUpload(file);
        return { file: preparedFile, originalIndex: index, success: true };
      } catch (error) {
        console.error(`❌ Error preparing file ${file.name}:`, error);
        return { file, originalIndex: index, success: false, error };
      }
    });

    const preparedResults = await Promise.allSettled(preparePromises);
    const successfullyPrepared = preparedResults
      .filter((result): result is PromiseFulfilledResult<{file: File, originalIndex: number, success: true}> => 
        result.status === 'fulfilled' && result.value.success)
      .map(result => result.value);

    console.log('MediaUpload - files prepared:', successfullyPrepared.length, 'of', validFiles.length);

    // Configurar concurrencia inteligente
    const concurrencyLimit = isMobile && isSlowConnection ? 1 : (isMobile ? 2 : 3);
    
    // Procesar uploads en lotes con reintentos
    for (let i = 0; i < successfullyPrepared.length; i += concurrencyLimit) {
      const batch = successfullyPrepared.slice(i, i + concurrencyLimit);
      
      const batchResults = await Promise.allSettled(
        batch.map(async ({ file, originalIndex }) => {
          const maxRetries = 2;
          let retryCount = 0;
          
          while (retryCount <= maxRetries) {
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
                return { success: true, type: 'offline' };
              } else {
                const data = await uploadMediaAsync({
                  file,
                  reportId,
                  checklistItemId,
                });
                
                console.log(`✅ MediaUpload - batch upload ${originalIndex + 1} successful:`, data);
                onMediaCaptured(data.file_url);
                
                // CRITICAL: Invalidar cache después de cada upload exitoso en batch
                queryClient.invalidateQueries({ queryKey: ['task-media', reportId] });
                
                return { success: true, type: 'online', data };
              }
            } catch (error) {
              retryCount++;
              console.error(`❌ MediaUpload - batch upload ${originalIndex + 1} failed (attempt ${retryCount}):`, error);
              
              if (retryCount > maxRetries) {
                return { success: false, error, file: file.name };
              }
              
              // Esperar antes del reintento
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
          }
        })
      );

      // Contar resultados del lote
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          if (result.value.type === 'offline') {
            offlineCount++;
          } else {
            successCount++;
          }
        } else {
          errorCount++;
        }
      });

      // Pausa entre lotes para no saturar en móvil
      if (isMobile && i + concurrencyLimit < successfullyPrepared.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log('MediaUpload - batch upload process completed:', { 
      successCount, 
      errorCount, 
      offlineCount, 
      total: validFiles.length 
    });
    
    setUploadingCount(0);
    
    // CRITICAL: Invalidar cache completo después del batch upload
    if (successCount > 0) {
      queryClient.invalidateQueries({ queryKey: ['task-media'] });
      queryClient.invalidateQueries({ queryKey: ['all-task-media'] }); 
      queryClient.invalidateQueries({ queryKey: ['task-reports'] });
    }
    
    // Mostrar resultado final
    if (offlineCount > 0 && successCount === 0) {
      toast({
        title: "Archivos guardados offline",
        description: `${offlineCount} archivo(s) se subirán automáticamente cuando tengas conexión.`,
      });
    } else if (successCount > 0) {
      toast({
        title: "Subida completada",
        description: `${successCount} archivo(s) subido(s) correctamente.${offlineCount > 0 ? ` ${offlineCount} guardado(s) offline.` : ''}${errorCount > 0 ? ` ${errorCount} fallaron.` : ''}`,
      });
    } else if (errorCount > 0) {
      toast({
        title: "Error en la subida",
        description: "No se pudo subir ningún archivo. Verifica el formato, tamaño y conexión.",
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
    validateFile,
  };
};