import { useEffect, useRef, useState } from 'react';
import { useTaskReports } from '@/hooks/useTaskReports';
import { useToast } from '@/hooks/use-toast';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { compressImage, getMimeType, shouldCompressImage } from '@/utils/imageCompression';
import { useCleanerWorkActions } from '@/features/cleaner/CleanerWorkContext';

interface UseMediaUploadProps {
  reportId?: string;
  checklistItemId?: string;
  onMediaCaptured: (mediaUrl: string) => void;
  onUploadError?: (error: string | Error, context?: unknown, userAction?: string) => void;
  existingMediaCount: number;
}

export const useMediaUpload = ({ reportId, checklistItemId, onMediaCaptured, onUploadError, existingMediaCount }: UseMediaUploadProps) => {
  const { uploadMediaAsync } = useTaskReports({ fetchReports: false });
  const cleanerWork = useCleanerWorkActions();
  const { toast } = useToast();
  const { isOnline, isSlowConnection } = useNetworkStatus();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const previewRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const validateFile = (file: File): { isValid: boolean; error?: string } => {
    if (!file?.size) return { isValid: false, error: 'El archivo está vacío.' };
    if (file.size > 200 * 1024 * 1024) return { isValid: false, error: 'El archivo supera los 200 MB.' };
    if (!/^(image|video)\//.test(getMimeType(file))) return { isValid: false, error: 'Selecciona una foto o un vídeo compatible.' };
    return { isValid: true };
  };

  const uploadFiles = async (files: File[]) => {
    if (busyRef.current || !files.length) return;
    if (!reportId || existingMediaCount + files.length > 20) {
      toast({ title: 'No se han guardado los archivos', description: !reportId ? 'Inicia la tarea antes de adjuntar fotos.' : 'Puedes adjuntar hasta 20 archivos por apartado.', variant: 'destructive' });
      return;
    }
    busyRef.current = true;
    cleanerWork?.changePhotoPreparation(1);
    setUploadingCount(files.length);
    let saved = 0;
    try {
      // Decode one image at a time to bound memory usage on a phone.
      for (const file of files) {
        try {
          const valid = validateFile(file);
          if (!valid.isValid) throw new Error(valid.error);
          if (!cleanerWork && !navigator.onLine) throw new Error('No hay conexión. Esta foto no se ha enviado; vuelve a adjuntarla cuando tengas cobertura.');
          const url = URL.createObjectURL(file);
          if (previewRef.current) URL.revokeObjectURL(previewRef.current);
          previewRef.current = url;
          if (mounted.current) setPreviewUrl(url);
          const prepared = shouldCompressImage(file) ? await compressImage(file, {
            maxWidth: isSlowConnection ? 1024 : 1600, maxHeight: isSlowConnection ? 1024 : 1600,
            quality: isSlowConnection ? 0.65 : 0.78, maxSizeKB: 800,
          }) : file;
          const media = await uploadMediaAsync({ file: prepared, reportId, checklistItemId });
          if (mounted.current) onMediaCaptured(media.file_url);
          saved++;
        } catch (reason) {
          const error = reason instanceof Error ? reason : new Error(String((reason as { message?: string })?.message || 'No se ha guardado el archivo.'));
          onUploadError?.(error, { reportId, checklistItemId }, 'Adjuntando una foto');
          toast({ title: 'No se ha guardado la foto', description: error.message, variant: 'destructive' });
        } finally {
          if (previewRef.current) URL.revokeObjectURL(previewRef.current);
          previewRef.current = null;
          if (mounted.current) { setPreviewUrl(null); setUploadingCount(count => Math.max(0, count - 1)); }
        }
      }
      if (saved) toast({ title: cleanerWork ? 'Fotos guardadas en este móvil' : 'Archivos enviados', description: cleanerWork ? `${saved} archivo(s) conservados. Puedes seguir; el envío se confirmará con cobertura.` : `${saved} archivo(s) enviados correctamente.` });
    } finally {
      busyRef.current = false;
      cleanerWork?.changePhotoPreparation(-1);
      if (mounted.current) setUploadingCount(0);
    }
  };

  return {
    uploadSingleFile: (file: File) => uploadFiles([file]),
    uploadMultipleFiles: (files: FileList) => uploadFiles(Array.from(files)),
    isUploadingMedia: uploadingCount > 0,
    uploadingCount, previewUrl, isOnline, isSlowConnection, validateFile,
  };
};
