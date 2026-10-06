import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload } from 'lucide-react';
import { useCleanerWorkActions } from '@/features/cleaner/CleanerWorkContext';

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
  const local = useCleanerWorkActions();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('📁 Archivo seleccionado:', file.name, `(${Math.round(file.size / 1024)}KB)`, file.type || 'sin tipo');
      onSingleFileSelect(file);
    }
    // Reset input para permitir re-selección del mismo archivo
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMultipleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      console.log('📁 Archivos seleccionados:', files.length);
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
        className="min-h-11 px-3 text-sm"
        aria-label="Tomar foto o seleccionar archivo"
      >
        <Camera className="h-3 w-3 mr-1" />
        {isUploading ? (local ? 'Guardando…' : 'Subiendo…') : 'Foto'}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => galleryInputRef.current?.click()}
        disabled={isUploading || uploadingCount > 0}
        className="min-h-11 px-3 text-sm"
        aria-label="Seleccionar múltiples archivos de la galería"
      >
        <Upload className="h-3 w-3 mr-1" />
        {uploadingCount > 0 ? `${local ? 'Guardando' : 'Subiendo'} ${uploadingCount}…` : 'Galería'}
      </Button>

      {/* Input para foto individual - sin capture para máxima compatibilidad Android */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
        aria-hidden="true"
      />

      {/* Input para selección múltiple de galería */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleMultipleFileSelect}
        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
        aria-hidden="true"
      />
    </div>
  );
};
