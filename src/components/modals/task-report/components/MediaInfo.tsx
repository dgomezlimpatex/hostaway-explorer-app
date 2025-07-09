import React from 'react';

interface MediaInfoProps {
  existingMediaCount: number;
  isReadOnly?: boolean;
}

export const MediaInfo: React.FC<MediaInfoProps> = ({
  existingMediaCount,
  isReadOnly = false,
}) => {
  if (isReadOnly) return null;

  return (
    <div className="text-xs text-muted-foreground">
      {existingMediaCount}/15 archivos • Máximo 50MB por archivo
    </div>
  );
};