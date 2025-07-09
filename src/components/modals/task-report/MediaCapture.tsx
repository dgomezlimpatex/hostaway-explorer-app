
import React from 'react';
import { TaskMedia } from '@/types/taskReports';
import { useMediaUpload } from './hooks/useMediaUpload';
import { MediaUploadButtons } from './components/MediaUploadButtons';
import { MediaPreview } from './components/MediaPreview';
import { MediaGrid } from './components/MediaGrid';
import { MediaInfo } from './components/MediaInfo';

interface MediaCaptureProps {
  onMediaCaptured: (mediaUrl: string) => void;
  onMediaDeleted?: (mediaId: string) => void;
  reportId?: string;
  checklistItemId?: string;
  existingMedia?: TaskMedia[] | string[];
  isReadOnly?: boolean;
}

export const MediaCapture: React.FC<MediaCaptureProps> = ({
  onMediaCaptured,
  onMediaDeleted,
  reportId,
  checklistItemId,
  existingMedia = [],
  isReadOnly = false,
}) => {
  const {
    uploadSingleFile,
    uploadMultipleFiles,
    isUploadingMedia,
    uploadingCount,
    previewUrl,
  } = useMediaUpload({
    reportId,
    checklistItemId,
    onMediaCaptured,
    existingMediaCount: existingMedia.length,
  });

  return (
    <div className="space-y-3">
      {!isReadOnly && (
        <MediaUploadButtons
          onSingleFileSelect={uploadSingleFile}
          onMultipleFileSelect={uploadMultipleFiles}
          isUploading={isUploadingMedia}
          uploadingCount={uploadingCount}
        />
      )}

      <MediaPreview previewUrl={previewUrl} />

      <MediaInfo 
        existingMediaCount={existingMedia.length}
        isReadOnly={isReadOnly}
      />

      <MediaGrid
        existingMedia={existingMedia}
        onMediaDeleted={onMediaDeleted}
        isReadOnly={isReadOnly}
      />
    </div>
  );
};
