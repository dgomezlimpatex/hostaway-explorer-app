import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Image as ImageIcon, 
  Search, 
  Download, 
  Calendar,
  User,
  Grid3X3,
  List,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  Building2,
  Play
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTaskReports } from '@/hooks/useTaskReports';
import { useTaskMedia, useAllTaskMedia } from '@/hooks/useTaskMedia';
import { useCleaners } from '@/hooks/useCleaners';
import { useProperties } from '@/hooks/useProperties';
import { taskStorageService } from '@/services/taskStorage';
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
  const { cleaners } = useCleaners();
  const { data: properties = [] } = useProperties();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Obtener imágenes del reporte seleccionado
  const { data: reportMedia = [] } = useTaskMedia(selectedReport?.id);
  
  // Hook para obtener todas las imágenes de todos los reportes
  const { data: allTaskMedia = [] } = useAllTaskMedia();

  // Cargar todas las tareas al montar el componente
  useEffect(() => {
    const loadAllTasks = async () => {
      try {
        const tasks = await taskStorageService.getTasks();
        setAllTasks(tasks);
      } catch (error) {
        console.error('Error loading all tasks:', error);
      }
    };
    loadAllTasks();
  }, []);

  // Procesar reportes con información de tareas y propiedades
  const processedReports = useMemo(() => {
    if (!reports || !allTasks || !properties || !allTaskMedia) return [];
    
    return reports.map((report: any) => {
      // Buscar la tarea asociada al reporte
      const task = allTasks.find(t => t.id === report.task_id);
      // Buscar la propiedad asociada a la tarea
      const propertyId = task?.propertyId || (task as any)?.propiedad_id;
      const property = propertyId ? properties.find(p => p.id === propertyId) : null;
      // Buscar el limpiador
      const cleaner = cleaners.find(c => c.id === report.cleaner_id);
      
      // Obtener solo las fotos de la sección "fotos" (sin checklist_item_id)
      const photosFromMediaSection = allTaskMedia
        .filter(media => 
          media.task_report_id === report.id && 
          !media.checklist_item_id && // Solo fotos de la sección "fotos", no del checklist
          media.media_type === 'photo'
        )
        .map(media => media.file_url);

      // Obtener imágenes de incidencias (mantener estas)
      const incidentImages: string[] = [];
      if (Array.isArray(report.issues_found)) {
        report.issues_found.forEach((issue: any) => {
          if (issue?.media_urls && Array.isArray(issue.media_urls)) {
            incidentImages.push(...issue.media_urls);
          }
        });
      }

      // Combinar solo fotos de la sección "fotos" e incidencias
      const allImages: string[] = [...photosFromMediaSection, ...incidentImages];
      
      return {
        ...report,
        task: task,
        property: property,
        propertyName: property?.nombre || 'Propiedad no encontrada',
        propertyCode: property?.codigo || 'N/A',
        cleanerName: cleaner?.name || 'No asignado',
        taskDate: task?.date || '',
        taskStartTime: task?.startTime || '',
        totalImages: allImages.length,
        previewImage: allImages[0] || null, // Primera imagen como preview
        allImages: allImages
      };
    }).filter(report => report.totalImages > 0); // Solo mostrar reportes con imágenes
  }, [reports, allTasks, properties, cleaners, allTaskMedia]);

  // Filtrar reportes
  const filteredReports = useMemo(() => {
    let filtered = processedReports;

    // Filtro por término de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(report => 
        report.propertyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.propertyCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.cleanerName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(report => report.overall_status === statusFilter);
    }

    // Aplicar filtros del dashboard principal
    if (filters.cleaner !== 'all') {
      filtered = filtered.filter(report => report.cleaner_id === filters.cleaner);
    }

    if (filters.property !== 'all') {
      filtered = filtered.filter(report => {
        const propertyId = report.task?.propertyId || (report.task as any)?.propiedad_id;
        return propertyId === filters.property;
      });
    }

    // Ordenar por fecha más reciente
    return filtered.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [processedReports, searchTerm, statusFilter, filters]);

  const handleReportClick = (report: any) => {
    setSelectedReport(report);
    setCurrentImageIndex(0);
    setShowReportModal(true);
  };

  const nextImage = () => {
    if (selectedReport && currentImageIndex < selectedReport.allImages.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  const prevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const downloadImage = async (imageUrl: string, fileName?: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || `evidencia-${selectedReport?.id}-${currentImageIndex + 1}.${imageUrl.split('.').pop()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  const downloadAllImages = async () => {
    if (!selectedReport || !selectedReport.allImages.length) return;
    
    for (let i = 0; i < selectedReport.allImages.length; i++) {
      const imageUrl = selectedReport.allImages[i];
      const fileName = `evidencia-${selectedReport.propertyCode}-${selectedReport.taskDate}-${i + 1}.${imageUrl.split('.').pop()}`;
      await downloadImage(imageUrl, fileName);
      // Pequeño delay para no sobrecargar el navegador
      await new Promise(resolve => setTimeout(resolve, 200));
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
              Galería de Reportes ({filteredReports.length})
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
                  placeholder="Buscar reportes..."
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
                  <label className="text-sm font-medium">Estado del reporte</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="completed">Completado</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="in_progress">En progreso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Contenido de la galería */}
      {filteredReports.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay reportes con evidencias disponibles
            </h3>
            <p className="text-gray-600">
              Los reportes con evidencias fotográficas aparecerán aquí una vez que los limpiadores los completen.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        /* Vista en grid - cada cuadrado es un reporte */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredReports.map((report) => (
            <Card key={report.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleReportClick(report)}>
              <div className="relative group">
                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                  {report.previewImage ? (
                    <img
                      src={report.previewImage}
                      alt={`Reporte ${report.propertyName}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  )}
                  
                  {/* Indicador de número de imágenes */}
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-black/50 text-white">
                      {report.totalImages} fotos
                    </Badge>
                  </div>
                  
                  {/* Overlay con botón ver */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button size="sm" variant="secondary">
                      <Eye className="h-4 w-4 mr-2" />
                      Ver todas
                    </Button>
                  </div>
                </div>
                
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-blue-600" />
                      <h4 className="font-medium text-sm line-clamp-1">
                        {report.propertyName}
                      </h4>
                    </div>
                    
                    {report.propertyCode && report.propertyCode !== 'N/A' && (
                      <div className="text-xs text-gray-500">
                        Código: {report.propertyCode}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {report.taskDate ? format(new Date(report.taskDate), 'dd/MM/yy', { locale: es }) : 'Sin fecha'}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {report.cleanerName}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        report.overall_status === 'completed' ? 'default' : 
                        report.overall_status === 'pending' ? 'secondary' : 'outline'
                      } className="text-xs">
                        {report.overall_status === 'completed' ? 'Completado' : 
                         report.overall_status === 'pending' ? 'Pendiente' : 'En progreso'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* Vista en lista */
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <Card key={report.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleReportClick(report)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                    {report.previewImage ? (
                      <img
                        src={report.previewImage}
                        alt={`Reporte ${report.propertyName}`}
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.svg';
                        }}
                      />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-4 w-4 text-blue-600" />
                          <h4 className="font-medium text-base">
                            {report.propertyName}
                          </h4>
                          {report.propertyCode && report.propertyCode !== 'N/A' && (
                            <span className="text-gray-500 text-sm">({report.propertyCode})</span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge variant="outline">{report.totalImages} fotos</Badge>
                          <Badge variant={
                            report.overall_status === 'completed' ? 'default' : 
                            report.overall_status === 'pending' ? 'secondary' : 'outline'
                          }>
                            {report.overall_status === 'completed' ? 'Completado' : 
                             report.overall_status === 'pending' ? 'Pendiente' : 'En progreso'}
                          </Badge>
                          <Badge variant="outline">{report.cleanerName}</Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {report.taskDate ? format(new Date(report.taskDate), 'dd/MM/yyyy', { locale: es }) : 'Sin fecha'}
                          </div>
                          {report.task?.address && (
                            <div className="flex items-center gap-1">
                              <Building2 className="h-4 w-4" />
                              {report.task.address}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          Ver evidencias
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

      {/* Modal de reporte con todas las imágenes */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedReport?.propertyName} - Evidencias del Reporte
            </DialogTitle>
          </DialogHeader>
          
          {selectedReport && (
            <div className="space-y-6">
              {/* Información del reporte */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Propiedad:</span><br />
                    {selectedReport.propertyName}
                    {selectedReport.propertyCode && selectedReport.propertyCode !== 'N/A' && (
                      <span className="text-gray-600"> ({selectedReport.propertyCode})</span>
                    )}
                  </div>
                  <div>
                    <span className="font-medium">Limpiador:</span><br />
                    {selectedReport.cleanerName}
                  </div>
                  <div>
                    <span className="font-medium">Fecha:</span><br />
                    {selectedReport.taskDate ? format(new Date(selectedReport.taskDate), 'dd/MM/yyyy', { locale: es }) : 'Sin fecha'}
                  </div>
                  <div>
                    <span className="font-medium">Total evidencias:</span><br />
                    {selectedReport.totalImages} fotos
                  </div>
                </div>
              </div>

              {/* Visualizador de imágenes */}
              {selectedReport.allImages.length > 0 && (
                <div className="space-y-4">
                  <div className="relative">
                    <img
                      src={selectedReport.allImages[currentImageIndex]}
                      alt={`Evidencia ${currentImageIndex + 1}`}
                      className="w-full max-h-[60vh] object-contain rounded-lg"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                    
                    {/* Controles de navegación */}
                    {selectedReport.allImages.length > 1 && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="absolute left-2 top-1/2 transform -translate-y-1/2"
                          onClick={prevImage}
                          disabled={currentImageIndex === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2"
                          onClick={nextImage}
                          disabled={currentImageIndex === selectedReport.allImages.length - 1}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        
                        {/* Indicador de posición */}
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
                          <Badge variant="secondary" className="bg-black/50 text-white">
                            {currentImageIndex + 1} / {selectedReport.allImages.length}
                          </Badge>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Thumbnails */}
                  {selectedReport.allImages.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {selectedReport.allImages.map((image: string, index: number) => (
                        <img
                          key={index}
                          src={image}
                          alt={`Thumbnail ${index + 1}`}
                          className={`w-16 h-16 object-cover rounded cursor-pointer border-2 flex-shrink-0 ${
                            index === currentImageIndex ? 'border-blue-500' : 'border-gray-200'
                          }`}
                          onClick={() => setCurrentImageIndex(index)}
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder.svg';
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-2 pt-4">
                <Button onClick={() => downloadImage(selectedReport.allImages[currentImageIndex])}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar imagen actual
                </Button>
                <Button onClick={downloadAllImages} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Descargar todas ({selectedReport.totalImages})
                </Button>
                <Button variant="outline" onClick={() => setShowReportModal(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};