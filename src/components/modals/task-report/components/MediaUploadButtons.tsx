import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload } from 'lucide-react';

interface MediaUploadButtonsProps {
  onSingleFileSelect: (file: File) => void;
  onMultipleFileSelect: (files: FileList) => void;
  isUploading: boolean;
  uploadingCount: number;
}

export const MediaUploadButtons: React.FC<MediaUploadButtonsProps> = ({
  onSingleFileSelect,
  onMultipleFileSelect,
  isUploading,
  uploadingCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onSingleFileSelect(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMultipleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onMultipleFileSelect(files);
    }
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading || uploadingCount > 0}
        className="text-xs px-2 py-1 h-7"
      >
        <Camera className="h-3 w-3 mr-1" />
        {isUploading ? 'Subiendo...' : 'Foto'}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => galleryInputRef.current?.click()}
        disabled={isUploading || uploadingCount > 0}
        className="text-xs px-2 py-1 h-7"
      >
        <Upload className="h-3 w-3 mr-1" />
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
  );
};