
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
}

export const MediaCapture: React.FC<MediaCaptureProps> = ({
  onMediaCaptured,
  reportId,
  checklistItemId,
  existingMedia = [],
}) => {
  const { uploadMediaAsync, isUploadingMedia } = useTaskReports();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
        const data = await uploadMediaAsync({
          file,
          reportId,
          checklistItemId,
        });
        console.log('Media uploaded successfully:', data);
        onMediaCaptured(data.file_url);
        setPreviewUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Error uploading media:', error);
        setPreviewUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    
    uploadFile();
  };

  const removeMedia = (mediaUrl: string) => {
    // TODO: Implementar eliminación del servidor
    const updatedMedia = existingMedia.filter(url => url !== mediaUrl);
    onMediaCaptured(updatedMedia[updatedMedia.length - 1] || '');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingMedia}
        >
          <Camera className="h-4 w-4 mr-2" />
          {isUploadingMedia ? 'Subiendo...' : 'Tomar Foto'}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingMedia}
        >
          <Upload className="h-4 w-4 mr-2" />
          Subir Archivo
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Preview de archivo siendo subido */}
      {previewUrl && (
        <div className="border rounded-lg p-2">
          <p className="text-sm text-gray-600 mb-2">Subiendo archivo...</p>
          <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center">
            <Upload className="h-6 w-6 animate-pulse text-gray-400" />
          </div>
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
