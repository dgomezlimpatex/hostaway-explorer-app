import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

// Secure file upload configuration
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/mov', 'video/avi', 'video/mkv'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for images
const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20MB for videos
const DANGEROUS_EXTENSIONS = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.js', '.html', '.htm', '.php', '.asp'];

interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export const useFileUploadSecurity = () => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const validateFile = (file: File, type: 'image' | 'video'): FileValidationResult => {
    // Check file extension for dangerous types
    const fileName = file.name.toLowerCase();
    const hasDangerousExtension = DANGEROUS_EXTENSIONS.some(ext => fileName.endsWith(ext));
    
    if (hasDangerousExtension) {
      return { isValid: false, error: 'File type not allowed for security reasons' };
    }

    // Validate MIME type
    const allowedTypes = type === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
    if (!allowedTypes.includes(file.type)) {
      return { 
        isValid: false, 
        error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}` 
      };
    }

    // Validate file size
    const maxSize = type === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      return { 
        isValid: false, 
        error: `File too large. Maximum size: ${maxSizeMB}MB` 
      };
    }

    // Additional security checks
    if (file.size === 0) {
      return { isValid: false, error: 'Empty file not allowed' };
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