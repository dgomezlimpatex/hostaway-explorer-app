import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

// Secure file upload configuration
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 
  'image/heic', 'image/heif', 'image/tiff', 'image/tif', 'image/bmp', 
  'image/svg+xml', 'image/avif', 'image/jfif', 'image/pjpeg', 
  'image/x-icon', 'image/vnd.microsoft.icon', 'image/dng',
  // Formatos RAW de cámaras
  'image/x-canon-cr2', 'image/x-canon-crw', 'image/x-nikon-nef', 
  'image/x-sony-arw', 'image/x-adobe-dng', 'image/x-panasonic-raw',
  // Formatos adicionales de móviles
  'image/x-ms-bmp', 'image/x-portable-pixmap', 'image/x-portable-graymap',
  // Formatos RAW adicionales de iPhone y otros dispositivos
  'image/x-adobe-dng', 'application/octet-stream', // iPhone .dng files
  'image/x-raw', 'image/x-dng'
];
const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/webm', 'video/mov', 'video/avi', 'video/mkv', 
  'video/quicktime', 'video/x-msvideo', 'video/3gpp', 'video/3gpp2',
  'video/x-ms-wmv', 'video/x-flv', 'video/ogg', 'video/m4v'
];
const MAX_IMAGE_SIZE = 100 * 1024 * 1024; // 100MB for images
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB for videos
const DANGEROUS_EXTENSIONS = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.js', '.html', '.htm', '.php', '.asp'];

interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export const useFileUploadSecurity = () => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const validateFile = (file: File, type: 'image' | 'video' = 'image'): FileValidationResult => {
    // Validación básica
    if (!file || !file.name) {
      return { isValid: false, error: 'Archivo no válido' };
    }

    // Verificar extensiones peligrosas
    const fileName = file.name.toLowerCase();
    const hasDangerousExtension = DANGEROUS_EXTENSIONS.some(ext => fileName.endsWith(ext));
    
    if (hasDangerousExtension) {
      return { isValid: false, error: 'Tipo de archivo no permitido por seguridad' };
    }

    // Validar tipo MIME - pero también aceptar archivos si la extensión es válida
    const allowedTypes = type === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
    const fileExtension = file.name.toLowerCase().split('.').pop();
    
    // Lista de extensiones válidas para imágenes (incluye formatos RAW)
    const validImageExtensions = [
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'tiff', 'tif', 
      'bmp', 'svg', 'avif', 'dng', 'raw', 'cr2', 'crw', 'nef', 'arw', 'orf', 'rw2'
    ];
    
    // Lista de extensiones válidas para videos
    const validVideoExtensions = [
      'mp4', 'webm', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'ogg', 'm4v', '3gp', '3gpp'
    ];
    
    const validExtensions = type === 'image' ? validImageExtensions : validVideoExtensions;
    
    // Aceptar si el tipo MIME es válido O si la extensión es válida
    const hasValidMimeType = allowedTypes.includes(file.type);
    const hasValidExtension = fileExtension && validExtensions.includes(fileExtension);
    
    if (!hasValidMimeType && !hasValidExtension) {
      return { 
        isValid: false, 
        error: `Formato no soportado. Extensiones válidas: ${validExtensions.slice(0, 10).join(', ')}...` 
      };
    }

    // Validar tamaño de archivo
    const maxSize = type === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      return { 
        isValid: false, 
        error: `Archivo muy grande. Tamaño máximo: ${maxSizeMB}MB` 
      };
    }

    // Verificaciones adicionales de seguridad
    if (file.size === 0) {
      return { isValid: false, error: 'Archivo vacío no permitido' };
    }

    return { isValid: true };
  };

  const secureFileUpload = async (
    file: File, 
    bucket: string, 
    path: string, 
    type: 'image' | 'video'
  ): Promise<{ data?: any; error?: any }> => {
    setIsUploading(true);

    try {
      // Validate file
      const validation = validateFile(file, type);
      if (!validation.isValid) {
        toast({
          title: 'Upload Error',
          description: validation.error,
          variant: 'destructive',
        });
        return { error: { message: validation.error } };
      }

      // Generate secure filename
      const fileExtension = file.name.split('.').pop();
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const securePath = `${path}/${timestamp}_${randomString}.${fileExtension}`;

      // Upload with additional security headers
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(securePath, file, {
          cacheControl: '3600',
          upsert: false,
          metadata: {
            'uploaded-by': 'app',
            'content-type': file.type,
            'original-name': file.name,
            'upload-timestamp': new Date().toISOString(),
          }
        });

      if (error) {
        toast({
          title: 'Upload Failed',
          description: error.message,
          variant: 'destructive',
        });
        return { error };
      }

      // Get public URL for uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return { data: { ...data, publicUrl } };

    } catch (error: any) {
      toast({
        title: 'Upload Error',
        description: 'An unexpected error occurred during upload',
        variant: 'destructive',
      });
      return { error };
    } finally {
      setIsUploading(false);
    }
  };

  const deleteFile = async (bucket: string, path: string) => {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) {
        toast({
          title: 'Delete Failed',
          description: error.message,
          variant: 'destructive',
        });
        return { error };
      }

      return { success: true };
    } catch (error: any) {
      toast({
        title: 'Delete Error',
        description: 'An unexpected error occurred during deletion',
        variant: 'destructive',
      });
      return { error };
    }
  };

  return {
    secureFileUpload,
    deleteFile,
    validateFile,
    isUploading,
  };
};