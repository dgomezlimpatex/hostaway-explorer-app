import React, { useMemo, memo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  TrendingUp,
  Calendar,
  Eye,
  MessageSquare
} from 'lucide-react';
import { useOptimizedCleaningReports } from '@/hooks/useOptimizedCleaningReports';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CleaningReportsDashboardProps {
  filters: {
    dateRange: string;
    cleaner: string;
    status: string;
    property: string;
    hasIncidents: string;
  };
}

export const CleaningReportsDashboard: React.FC<CleaningReportsDashboardProps> = memo(({
  filters,
}) => {
  const { dashboardMetrics, recentReports, isLoading } = useOptimizedCleaningReports(filters);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openReportModal = (report: any) => {
    setSelectedReport(report);
    setIsModalOpen(true);
  };

  const closeReportModal = () => {
    setSelectedReport(null);
    setIsModalOpen(false);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: 'secondary' as const, label: 'Pendiente', icon: Clock },
      in_progress: { variant: 'default' as const, label: 'En progreso', icon: TrendingUp },
      completed: { variant: 'default' as const, label: 'Completado', icon: CheckCircle },
      needs_review: { variant: 'destructive' as const, label: 'Revisar', icon: AlertTriangle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!dashboardMetrics) return null;

  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reportes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardMetrics.totalReports}</div>
            <p className="text-xs text-muted-foreground">
              Reportes registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{dashboardMetrics.completedReports}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Progress value={dashboardMetrics.completionRate} className="w-full h-2" />
              <span>{dashboardMetrics.completionRate.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Incidencias</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{dashboardMetrics.reportsWithIncidents}</div>
            <p className="text-xs text-muted-foreground">
              Requieren atención
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {dashboardMetrics.pendingReports + dashboardMetrics.inProgressReports}
            </div>
            <p className="text-xs text-muted-foreground">
              En proceso
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reportes recientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reportes Recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentReports.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay reportes para mostrar
              </p>
            ) : (
              recentReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">Reporte #{report.id.slice(0, 8)}</h4>
                      {getStatusBadge(report.overall_status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        {format(new Date(report.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </span>
                      <span>
                        {formatDistanceToNow(new Date(report.created_at), { 
                          addSuffix: true, 
                          locale: es 
                        })}
                      </span>
                      {report.issues_found && report.issues_found.length > 0 && (
                        <Badge variant="outline" className="text-orange-600">
                          {report.issues_found.length} incidencia(s)
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => openReportModal(report)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {report.notes && (
                      <Button variant="ghost" size="sm">
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de detalles del reporte */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold">
                  📋 Reporte de Limpieza #{selectedReport?.id?.slice(0, 8)}
                </DialogTitle>
                <p className="text-muted-foreground mt-1">
                  Detalles completos del reporte de limpieza
                </p>
              </div>
              {selectedReport && (
                <div className="flex items-center gap-3">
                  {getStatusBadge(selectedReport.overall_status)}
                  {selectedReport.issues_found && selectedReport.issues_found.length > 0 && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {selectedReport.issues_found.length} incidencia(s)
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {selectedReport && (
              <>
                {/* Información general en cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Fecha</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(selectedReport.created_at), 'dd/MM/yyyy', { locale: es })}
                      </p>
                    </CardContent>
                  </Card>

                  {selectedReport.start_time && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">Inicio</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(selectedReport.start_time), 'HH:mm', { locale: es })}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {selectedReport.end_time && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium">Finalización</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(selectedReport.end_time), 'HH:mm', { locale: es })}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium">Duración</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedReport.start_time && selectedReport.end_time ? (
                          `${Math.round((new Date(selectedReport.end_time).getTime() - new Date(selectedReport.start_time).getTime()) / (1000 * 60))} min`
                        ) : (
                          'N/A'
                        )}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Checklist completado */}
                {selectedReport.checklist_completed && Object.keys(selectedReport.checklist_completed).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        Lista de Verificación
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(selectedReport.checklist_completed).map(([key, value]) => {
                          // Convertir nombres técnicos a legibles
                          const formatTaskName = (name: string) => {
                            const parts = name.split('.');
                            if (parts.length === 2) {
                              const [room, task] = parts;
                              const roomNames: Record<string, string> = {
                                'bedroom': 'Dormitorio',
                                'kitchen': 'Cocina',
                                'bathroom': 'Baño',
                                'living_room': 'Sala de Estar'
                              };
                              const taskNames: Record<string, string> = {
                                'bedroom_bed': 'Cama',
                                'kitchen_sink': 'Fregadero',
                                'bedroom_vacuum': 'Aspirar',
                                'bathroom_mirror': 'Espejo',
                                'bathroom_shower': 'Ducha',
                                'bathroom_toilet': 'Inodoro',
                                'bathroom_towels': 'Toallas',
                                'bedroom_surfaces': 'Superficies',
                                'kitchen_surfaces': 'Superficies',
                                'living_vacuum': 'Aspirar',
                                'kitchen_appliances': 'Electrodomésticos',
                                'living_windows': 'Ventanas'
                              };
                              return `${roomNames[room] || room} - ${taskNames[task] || task}`;
                            }
                            return name;
                          };

                          return (
                            <div key={key} className={`flex items-center justify-between p-3 rounded-lg border ${
                              value ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                            }`}>
                              <span className="text-sm font-medium">{formatTaskName(key)}</span>
                              <Badge variant={value ? "default" : "secondary"} className={`${
                                value ? 'bg-green-600' : ''
                              }`}>
                                {value ? "✓ Completado" : "○ Pendiente"}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Estadísticas del checklist */}
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Progreso del checklist</span>
                          <span className="text-sm text-muted-foreground">
                            {Object.values(selectedReport.checklist_completed).filter(Boolean).length} / {Object.keys(selectedReport.checklist_completed).length}
                          </span>
                        </div>
                        <Progress 
                          value={(Object.values(selectedReport.checklist_completed).filter(Boolean).length / Object.keys(selectedReport.checklist_completed).length) * 100} 
                          className="mt-2"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Incidencias */}
                {selectedReport.issues_found && selectedReport.issues_found.length > 0 && (
                  <Card className="border-orange-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-orange-700">
                        <AlertTriangle className="h-5 w-5" />
                        Incidencias Encontradas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedReport.issues_found.map((issue: any, index: number) => (
                          <div key={index} className="p-4 border-l-4 border-orange-500 bg-orange-50 rounded-r-lg">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-orange-900">
                                  {issue.title || `Incidencia ${index + 1}`}
                                </p>
                                <p className="text-sm text-orange-700 mt-1">
                                  {issue.description || issue}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Notas */}
                {selectedReport.notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-blue-600" />
                        Notas Adicionales
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-900">
                          {selectedReport.notes}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});