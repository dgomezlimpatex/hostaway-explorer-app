import React from 'react';
import { Upload } from 'lucide-react';

interface MediaPreviewProps {
  previewUrl: string | null;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({ previewUrl }) => {
  if (!previewUrl) return null;

  return (
    <div className="border rounded-lg p-2">
      <p className="text-sm text-gray-600 mb-2">Subiendo archivo...</p>
      <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center">
        <Upload className="h-6 w-6 animate-pulse text-gray-400" />
      </div>
    </div>
  );
};