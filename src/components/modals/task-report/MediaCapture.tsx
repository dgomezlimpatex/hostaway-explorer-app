
import React from 'react';
import { TaskMedia } from '@/types/taskReports';
import { useMediaUpload } from './hooks/useMediaUpload';
import { MediaUploadButtons } from './components/MediaUploadButtons';
import { MediaPreview } from './components/MediaPreview';
import { MediaGrid } from './components/MediaGrid';
import { MediaInfo } from './components/MediaInfo';
import { useReportDebugger } from '@/utils/reportDebugger';

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
  const { logMedia } = useReportDebugger();
  const {
    uploadSingleFile,
    uploadMultipleFiles,
    isUploadingMedia,
    uploadingCount,
    previewUrl,
  } = useMediaUpload({
    reportId,
    checklistItemId,
    onMediaCaptured: (mediaUrl) => {
      logMedia('CAPTURED', { mediaUrl, reportId, checklistItemId }, reportId);
      onMediaCaptured(mediaUrl);
    },
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
