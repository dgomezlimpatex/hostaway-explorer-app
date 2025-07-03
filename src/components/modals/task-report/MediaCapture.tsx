
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, Video, Upload, X, Eye } from 'lucide-react';
import { useTaskReports } from '@/hooks/useTaskReports';
import { useToast } from '@/hooks/use-toast';

interface MediaCaptureProps {
  onMediaCaptured: (mediaUrl: string) => void;
  reportId?: string;
  checklistItemId?: string;
  existingMedia?: string[];
  isReadOnly?: boolean;
}

export const MediaCapture: React.FC<MediaCaptureProps> = ({
  onMediaCaptured,
  reportId,
  checklistItemId,
  existingMedia = [],
  isReadOnly = false,
}) => {
  const { uploadMediaAsync, isUploadingMedia } = useTaskReports();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !reportId) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos de imagen o video.",
        variant: "destructive",
      });
      return;
    }

    // Validar tamaño (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "Error", 
        description: "El archivo es demasiado grande. Máximo 50MB.",
        variant: "destructive",
      });
      return;
    }

    // Crear preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Subir archivo usando async/await
    const uploadFile = async () => {
      try {
        console.log('MediaCapture - attempting upload:', { file: file.name, reportId, checklistItemId });
        const data = await uploadMediaAsync({
          file,
          reportId,
          checklistItemId,
        });
        console.log('MediaCapture - upload successful:', data);
        onMediaCaptured(data.file_url);
        setPreviewUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        toast({
          title: "Archivo subido",
          description: "El archivo se ha subido correctamente.",
        });
      } catch (error) {
        console.error('MediaCapture - upload failed:', error);
        setPreviewUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        toast({
          title: "Error al subir archivo",
          description: "No se pudo subir el archivo. Inténtalo de nuevo.",
          variant: "destructive",
        });
      }
    };
    
    uploadFile();
  };

  const handleMultipleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !reportId) return;

    // Verificar límite de archivos (15 máximo + archivos existentes)
    const totalFiles = existingMedia.length + files.length;
    if (totalFiles > 15) {
      toast({
        title: "Error",
        description: `Puedes subir máximo 15 archivos. Ya tienes ${existingMedia.length} archivo(s).`,
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
      
      // Validar tipo de archivo
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        errorCount++;
        continue;
      }

      // Validar tamaño (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        errorCount++;
        continue;
      }

      try {
        console.log('MediaCapture - uploading multiple file:', { file: file.name, reportId, checklistItemId });
        const data = await uploadMediaAsync({
          file,
          reportId,
          checklistItemId,
        });
        console.log('MediaCapture - multiple upload successful:', data);
        onMediaCaptured(data.file_url);
        successCount++;
      } catch (error) {
        console.error('MediaCapture - multiple upload failed:', error);
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

    // Limpiar input
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
    }
  };

  const removeMedia = (mediaUrl: string) => {
    // TODO: Implementar eliminación del servidor
    const updatedMedia = existingMedia.filter(url => url !== mediaUrl);
    onMediaCaptured(updatedMedia[updatedMedia.length - 1] || '');
  };

  return (
    <div className="space-y-3">
      {!isReadOnly && (
        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingMedia || uploadingCount > 0}
          >
            <Camera className="h-4 w-4 mr-2" />
            {isUploadingMedia ? 'Subiendo...' : 'Tomar Foto'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => galleryInputRef.current?.click()}
            disabled={isUploadingMedia || uploadingCount > 0}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploadingCount > 0 ? `Subiendo ${uploadingCount}...` : 'Galería'}
          </Button>

          {/* Input para captura de cámara */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Input para selección múltiple de galería */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleMultipleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Preview de archivo siendo subido */}
      {previewUrl && (
        <div className="border rounded-lg p-2">
          <p className="text-sm text-gray-600 mb-2">Subiendo archivo...</p>
          <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center">
            <Upload className="h-6 w-6 animate-pulse text-gray-400" />
          </div>
        </div>
      )}

      {/* Mostrar información sobre límites */}
      {!isReadOnly && (
        <div className="text-xs text-muted-foreground">
          {existingMedia.length}/15 archivos • Máximo 50MB por archivo
        </div>
      )}

      {/* Media existente */}
      {existingMedia.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Archivos adjuntos:</p>
          <div className="flex flex-wrap gap-2">
            {existingMedia.map((mediaUrl, index) => (
              <div key={index} className="relative group">
                <div className="w-20 h-20 bg-gray-100 rounded border overflow-hidden">
                  {mediaUrl.includes('video') ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="h-6 w-6 text-gray-500" />
                    </div>
                  ) : (
                    <img
                      src={mediaUrl}
                      alt={`Media ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                
                {!isReadOnly && (
                  <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => removeMedia(mediaUrl)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => window.open(mediaUrl, '_blank')}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
