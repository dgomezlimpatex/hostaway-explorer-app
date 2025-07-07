import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Image as ImageIcon, 
  Search, 
  Download, 
  ZoomIn,
  Calendar,
  MapPin,
  User,
  Grid3X3,
  List,
  Filter,
  Trash2,
  Eye
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAllTaskMedia } from '@/hooks/useTaskMedia';
import { useMediaManagement } from '@/hooks/useMediaManagement';
import { useCleaners } from '@/hooks/useCleaners';
import { useProperties } from '@/hooks/useProperties';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CleaningReportsGalleryProps {
  filters: {
    dateRange: string;
    cleaner: string;
    status: string;
    property: string;
    hasIncidents: string;
  };
}

export const CleaningReportsGallery: React.FC<CleaningReportsGalleryProps> = ({
  filters,
}) => {
  const { data: mediaData = [], isLoading } = useAllTaskMedia();
  const { downloadMedia, deleteMedia, isDeleting } = useMediaManagement();
  const { cleaners } = useCleaners();
  const { data: properties = [] } = useProperties();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [mediaTypeFilter, setMediaTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Procesar datos de media
  const processedMedia = useMemo(() => {
    return mediaData.map((media: any) => {
      const report = media.task_reports;
      const task = report?.tasks;
      const cleaner = cleaners.find(c => c.id === report?.cleaner_id);
      
      return {
        ...media,
        reportId: report?.id,
        taskId: report?.task_id,
        property: task?.property || 'Propiedad desconocida',
        address: task?.address || '',
        cleanerName: cleaner?.name || task?.cleaner || 'No asignado',
        reportStatus: report?.overall_status || 'unknown',
        description: media.description || `Evidencia - ${media.media_type}`,
      };
    });
  }, [mediaData, cleaners]);

  // Filtrar media
  const filteredMedia = useMemo(() => {
    let filtered = processedMedia;

    // Filtro por término de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(media => 
        media.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        media.property.toLowerCase().includes(searchTerm.toLowerCase()) ||
        media.cleanerName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por tipo de media
    if (mediaTypeFilter !== 'all') {
      filtered = filtered.filter(media => media.media_type === mediaTypeFilter);
    }

    // Aplicar filtros del dashboard principal
    if (filters.cleaner !== 'all') {
      filtered = filtered.filter(media => {
        const cleaner = cleaners.find(c => c.name === media.cleanerName);
        return cleaner?.id === filters.cleaner;
      });
    }

    if (filters.property !== 'all') {
      filtered = filtered.filter(media => {
        const property = properties.find(p => p.nombre === media.property);
        return property?.id === filters.property;
      });
    }

    return filtered;
  }, [processedMedia, searchTerm, mediaTypeFilter, filters, cleaners, properties]);

  const handleImageClick = (media: any) => {
    setSelectedImage(media);
    setShowImageModal(true);
  };

  const handleDownloadMedia = (media: any) => {
    const fileName = `evidencia-${media.id}-${format(new Date(media.timestamp), 'ddMMyyyy')}.${media.file_url.split('.').pop()}`;
    downloadMedia(media.file_url, fileName);
  };

  const handleDeleteMedia = (mediaId: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta evidencia?')) {
      deleteMedia(mediaId);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="aspect-square bg-gray-200"></div>
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header de galería con controles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Galería de Evidencias ({filteredMedia.length})
            </CardTitle>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
              
              <div className="flex border rounded-lg">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none border-l"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar evidencias..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>
          
          {/* Panel de filtros expandible */}
          {showFilters && (
            <div className="border-t pt-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo de media</label>
                  <Select value={mediaTypeFilter} onValueChange={setMediaTypeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los tipos</SelectItem>
                      <SelectItem value="photo">Solo fotos</SelectItem>
                      <SelectItem value="video">Solo videos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Contenido de la galería */}
      {filteredMedia.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay evidencias disponibles
            </h3>
            <p className="text-gray-600">
              Las evidencias fotográficas aparecerán aquí una vez que los limpiadores completen sus reportes.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        /* Vista en grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMedia.map((media) => (
            <Card key={media.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative group">
                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                  {media.media_type === 'video' ? (
                    <video
                      src={media.file_url}
                      className="w-full h-full object-cover"
                      muted
                      poster={media.file_url} // En un caso real, tendrías un thumbnail
                    />
                  ) : (
                    <img
                      src={media.file_url}
                      alt={media.description}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                  )}
                  
                  {/* Indicador de tipo de media */}
                  {media.media_type === 'video' && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="bg-black/50 text-white">
                        Video
                      </Badge>
                    </div>
                  )}
                </div>
                
                {/* Overlay con acciones */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleImageClick(media)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownloadMedia(media)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteMedia(media.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-4">
                <h4 className="font-medium text-sm mb-2 line-clamp-2">
                  {media.description}
                </h4>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {media.property}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {media.media_type}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(media.timestamp), 'dd/MM/yy', { locale: es })}
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {media.cleanerName}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Vista en lista */
        <div className="space-y-4">
          {filteredMedia.map((media) => (
            <Card key={media.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                    {media.media_type === 'video' ? (
                      <video
                        src={media.file_url}
                        className="w-full h-full object-cover rounded-lg"
                        muted
                      />
                    ) : (
                      <img
                        src={media.file_url}
                        alt={media.description}
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.svg';
                        }}
                      />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-base mb-2">
                          {media.description}
                        </h4>
                        
                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge variant="outline">{media.property}</Badge>
                          <Badge variant="secondary">{media.media_type}</Badge>
                          <Badge variant="outline">{media.cleanerName}</Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(media.timestamp), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </div>
                          {media.address && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {media.address}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleImageClick(media)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadMedia(media)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteMedia(media.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de media ampliado */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Evidencia - {selectedImage?.media_type === 'video' ? 'Video' : 'Fotografía'}</DialogTitle>
          </DialogHeader>
          
          {selectedImage && (
            <div className="space-y-4">
              <div className="relative">
                {selectedImage.media_type === 'video' ? (
                  <video
                    src={selectedImage.file_url}
                    controls
                    className="w-full max-h-[60vh] object-contain rounded-lg"
                  />
                ) : (
                  <img
                    src={selectedImage.file_url}
                    alt={selectedImage.description}
                    className="w-full max-h-[60vh] object-contain rounded-lg"
                  />
                )}
              </div>
              
              <div className="space-y-3">
                <h3 className="text-lg font-medium">{selectedImage.description}</h3>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Propiedad:</span> {selectedImage.property}
                  </div>
                  <div>
                    <span className="font-medium">Limpiador:</span> {selectedImage.cleanerName}
                  </div>
                  <div>
                    <span className="font-medium">Fecha:</span>{' '}
                    {format(new Date(selectedImage.timestamp), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </div>
                  <div>
                    <span className="font-medium">Tipo:</span> {selectedImage.media_type}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{selectedImage.property}</Badge>
                  <Badge variant="secondary">{selectedImage.media_type}</Badge>
                  {selectedImage.checklist_item_id && (
                    <Badge variant="outline">Checklist: {selectedImage.checklist_item_id}</Badge>
                  )}
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button onClick={() => handleDownloadMedia(selectedImage)}>
                    <Download className="h-4 w-4 mr-2" />
                    Descargar
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      handleDeleteMedia(selectedImage.id);
                      setShowImageModal(false);
                    }}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </Button>
                  <Button variant="outline" onClick={() => setShowImageModal(false)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};