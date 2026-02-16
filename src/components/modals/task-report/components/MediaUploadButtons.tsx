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
      console.log('📁 ARCHIVO SELECCIONADO DESDE CÁMARA:', {
        name: file.name,
        size: file.size,
        sizeMB: Math.round(file.size / (1024 * 1024) * 100) / 100,
        type: file.type || 'desconocido',
        lastModified: file.lastModified,
        lastModifiedDate: new Date(file.lastModified).toISOString()
      });
      console.log('📁 Llamando a onSingleFileSelect...');
      onSingleFileSelect(file);
    } else {
      console.log('📁 No se seleccionó ningún archivo desde cámara');
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMultipleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      console.log('📁 Archivos seleccionados desde galería:', files.length, 'archivos');
      Array.from(files).forEach((file, index) => {
        console.log(`  ${index + 1}.`, file.name, `(${Math.round(file.size / 1024)}KB)`, file.type || 'tipo desconocido');
      });
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

      {/* Input para captura de cámara - sin capture fijo para máxima compatibilidad */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*;capture=camera,video/*;capture=camcorder"
        onChange={handleFileSelect}
        className="hidden"
        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
      />

      {/* Input para selección múltiple de galería */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleMultipleFileSelect}
        className="hidden"
        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
      />
    </div>
  );
};