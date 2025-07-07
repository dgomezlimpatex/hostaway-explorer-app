import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Image as ImageIcon, 
  Search, 
  Download, 
  ZoomIn,
  Calendar,
  MapPin,
  User
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTaskReports, useTaskMedia } from '@/hooks/useTaskReports';
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
  const { reports, isLoading } = useTaskReports();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // Obtener todas las imágenes de los reportes
  const allImages = useMemo(() => {
    if (!reports) return [];
    
    // Esta es una implementación simplificada
    // En la implementación real, deberías usar useTaskMedia para cada reporte
    const images: any[] = [];
    
    reports.forEach(report => {
      // Simular algunas imágenes para cada reporte
      if (report.overall_status === 'completed') {
        images.push({
          id: `${report.id}-1`,
          reportId: report.id,
          url: '/placeholder.svg', // Placeholder por ahora
          type: 'photo',
          description: 'Imagen post-limpieza - Cocina',
          timestamp: report.created_at,
          checklistItem: 'Limpieza de cocina'
        });
        images.push({
          id: `${report.id}-2`,
          reportId: report.id,
          url: '/placeholder.svg', // Placeholder por ahora
          type: 'photo',
          description: 'Imagen post-limpieza - Baño',
          timestamp: report.created_at,
          checklistItem: 'Limpieza de baño'
        });
      }
    });
    
    return images;
  }, [reports]);

  // Filtrar imágenes por búsqueda
  const filteredImages = useMemo(() => {
    if (!searchTerm) return allImages;
    
    return allImages.filter(image => 
      image.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      image.checklistItem.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allImages, searchTerm]);

  const handleImageClick = (image: any) => {
    setSelectedImage(image);
    setShowImageModal(true);
  };

  const handleDownloadImage = (image: any) => {
    // TODO: Implementar descarga real
    console.log('Downloading image:', image.id);
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
      {/* Header de galería */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Galería de Evidencias ({filteredImages.length})
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Grid de imágenes */}
      {filteredImages.length === 0 ? (
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredImages.map((image) => (
            <Card key={image.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative group">
                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                  <img
                    src={image.url}
                    alt={image.description}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder.svg';
                    }}
                  />
                </div>
                
                {/* Overlay con acciones */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleImageClick(image)}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownloadImage(image)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-4">
                <h4 className="font-medium text-sm mb-2 line-clamp-2">
                  {image.description}
                </h4>
                
                <div className="space-y-2">
                  <Badge variant="outline" className="text-xs">
                    {image.checklistItem}
                  </Badge>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(image.timestamp), 'dd/MM/yy', { locale: es })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de imagen ampliada */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Evidencia Fotográfica</DialogTitle>
          </DialogHeader>
          
          {selectedImage && (
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.description}
                  className="w-full max-h-[60vh] object-contain rounded-lg"
                />
              </div>
              
              <div className="space-y-3">
                <h3 className="text-lg font-medium">{selectedImage.description}</h3>
                
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(selectedImage.timestamp), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </div>
                  <Badge variant="outline">
                    {selectedImage.checklistItem}
                  </Badge>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button onClick={() => handleDownloadImage(selectedImage)}>
                    <Download className="h-4 w-4 mr-2" />
                    Descargar
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