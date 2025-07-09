import React from 'react';
import { Button } from '@/components/ui/button';
import { Video, X, Eye } from 'lucide-react';
import { TaskMedia } from '@/types/taskReports';
import { useMediaManagement } from '@/hooks/useMediaManagement';
import { useToast } from '@/hooks/use-toast';

interface MediaGridProps {
  existingMedia: TaskMedia[] | string[];
  onMediaDeleted?: (mediaId: string) => void;
  isReadOnly?: boolean;
}

export const MediaGrid: React.FC<MediaGridProps> = ({
  existingMedia,
  onMediaDeleted,
  isReadOnly = false,
}) => {
  const { deleteMedia, isDeleting } = useMediaManagement();
  const { toast } = useToast();

  const removeMedia = async (media: TaskMedia) => {
    try {
      console.log('MediaGrid - deleting media:', media.id);
      await deleteMedia(media.id);
      if (onMediaDeleted) {
        onMediaDeleted(media.id);
      }
      toast({
        title: "Foto eliminada",
        description: "La foto se ha eliminado correctamente.",
      });
    } catch (error) {
      console.error('MediaGrid - delete failed:', error);
      toast({
        title: "Error al eliminar",
        description: "No se pudo eliminar la foto. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  if (existingMedia.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Archivos adjuntos:</p>
      <div className="flex flex-wrap gap-2">
        {existingMedia.map((media, index) => {
          // Determine if media is TaskMedia object or string URL
          const isTaskMediaObject = typeof media === 'object' && 'id' in media;
          const mediaUrl = isTaskMediaObject ? media.file_url : media;
          const isVideo = isTaskMediaObject ? media.media_type === 'video' : mediaUrl.includes('video');
          const mediaId = isTaskMediaObject ? media.id : `url-${index}`;
          
          return (
            <div key={mediaId} className="relative group">
              <div className="w-20 h-20 bg-gray-100 rounded border overflow-hidden">
                {isVideo ? (
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
                    onClick={() => {
                      if (isTaskMediaObject) {
                        removeMedia(media as TaskMedia);
                      } else if (onMediaDeleted) {
                        // For string URLs, call onMediaDeleted to properly remove the item
                        onMediaDeleted(typeof media === 'string' ? media : media.id);
                      }
                    }}
                    disabled={isDeleting}
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
          );
        })}
      </div>
    </div>
  );
};