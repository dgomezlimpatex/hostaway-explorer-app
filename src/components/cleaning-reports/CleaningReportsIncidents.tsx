import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  AlertTriangle, 
  MessageSquare, 
  CheckCircle,
  Clock,
  User,
  Calendar,
  MapPin,
  UserPlus,
  Save
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTaskReports } from '@/hooks/useTaskReports';
import { useIncidentManagement } from '@/hooks/useIncidentManagement';
import { useCleaners } from '@/hooks/useCleaners';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CleaningReportsIncidentsProps {
  filters: {
    dateRange: string;
    cleaner: string;
    status: string;
    property: string;
    hasIncidents: string;
  };
}

export const CleaningReportsIncidents: React.FC<CleaningReportsIncidentsProps> = ({
  filters,
}) => {
  const { reports, isLoading } = useTaskReports();
  const { cleaners } = useCleaners();
  const { updateIncident, isUpdating } = useIncidentManagement();
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentStatus, setIncidentStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  // Procesar incidencias de los reportes
  const incidents = useMemo(() => {
    if (!reports) return [];
    
    const allIncidents: any[] = [];
    
    reports.forEach(report => {
      if (report.issues_found && Array.isArray(report.issues_found)) {
        report.issues_found.forEach((issue: any, index: number) => {
          allIncidents.push({
            id: `${report.id}-${index}`,
            reportId: report.id,
            taskId: report.task_id,
            cleanerId: report.cleaner_id,
            incidentIndex: index,
            title: issue.title || 'Incidencia sin título',
            description: issue.description || '',
            severity: issue.severity || 'medium',
            category: issue.category || 'general',
            status: issue.status || 'open',
            createdAt: report.created_at,
            location: issue.location || '',
            resolutionNotes: issue.resolutionNotes || '',
            resolvedAt: issue.resolvedAt || null,
            resolvedBy: issue.resolvedBy || null,
            assignedTo: issue.assignedTo || '',
            updatedAt: issue.updatedAt || report.created_at,
          });
        });
      }
    });
    
    return allIncidents.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [reports]);

  // Agrupar incidencias por categoría
  const incidentsByCategory = useMemo(() => {
    const categories: { [key: string]: any[] } = {};
    
    incidents.forEach(incident => {
      const category = incident.category || 'general';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(incident);
    });
    
    return categories;
  }, [incidents]);

  // Estadísticas de incidencias
  const incidentStats = useMemo(() => {
    const total = incidents.length;
    const open = incidents.filter(i => i.status === 'open').length;
    const inProgress = incidents.filter(i => i.status === 'in_progress').length;
    const resolved = incidents.filter(i => i.status === 'resolved').length;
    const critical = incidents.filter(i => i.severity === 'high').length;
    
    return { total, open, inProgress, resolved, critical };
  }, [incidents]);

  const getSeverityBadge = (severity: string) => {
    const config = {
      low: { variant: 'secondary' as const, label: 'Baja', color: 'text-green-600' },
      medium: { variant: 'default' as const, label: 'Media', color: 'text-yellow-600' },
      high: { variant: 'destructive' as const, label: 'Alta', color: 'text-red-600' },
    };
    
    const severityConfig = config[severity as keyof typeof config] || config.medium;
    
    return (
      <Badge variant={severityConfig.variant} className={severityConfig.color}>
        {severityConfig.label}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const config = {
      open: { variant: 'destructive' as const, label: 'Abierta', icon: AlertTriangle },
      in_progress: { variant: 'default' as const, label: 'En progreso', icon: Clock },
      resolved: { variant: 'secondary' as const, label: 'Resuelta', icon: CheckCircle },
    };
    
    const statusConfig = config[status as keyof typeof config] || config.open;
    const Icon = statusConfig.icon;
    
    return (
      <Badge variant={statusConfig.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {statusConfig.label}
      </Badge>
    );
  };

  const handleIncidentClick = (incident: any) => {
    setSelectedIncident(incident);
    setIncidentStatus(incident.status);
    setResolutionNotes(incident.resolutionNotes || '');
    setAssignedTo(incident.assignedTo || '');
    setShowIncidentModal(true);
  };

  const handleUpdateIncident = () => {
    if (!selectedIncident) return;

    updateIncident({
      reportId: selectedIncident.reportId,
      incidentIndex: selectedIncident.incidentIndex,
      updates: {
        status: incidentStatus as 'open' | 'in_progress' | 'resolved',
        resolutionNotes,
        assignedTo,
        resolvedBy: incidentStatus === 'resolved' ? 'current_user' : undefined,
      }
    });
    
    setShowIncidentModal(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas de incidencias */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{incidentStats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abiertas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{incidentStats.open}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{incidentStats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resueltas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{incidentStats.resolved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Críticas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{incidentStats.critical}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de incidencias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Incidencias Registradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                ¡Excelente! No hay incidencias
              </h3>
              <p className="text-gray-600">
                Todos los reportes de limpieza están sin problemas.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleIncidentClick(incident)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium">{incident.title}</h4>
                        {getSeverityBadge(incident.severity)}
                        {getStatusBadge(incident.status)}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{incident.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                       <div className="flex items-center gap-1">
                         <Calendar className="h-3 w-3" />
                         {format(new Date(incident.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                       </div>
                       {incident.location && (
                         <div className="flex items-center gap-1">
                           <MapPin className="h-3 w-3" />
                           {incident.location}
                         </div>
                       )}
                       {incident.assignedTo && (
                         <div className="flex items-center gap-1">
                           <User className="h-3 w-3" />
                           {cleaners.find(c => c.id === incident.assignedTo)?.name || incident.assignedTo}
                         </div>
                       )}
                       <Badge variant="outline" className="text-xs">
                         {incident.category}
                       </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalles de incidencia */}
      <Dialog open={showIncidentModal} onOpenChange={setShowIncidentModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gestión de Incidencia</DialogTitle>
          </DialogHeader>
          
          {selectedIncident && (
            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="text-lg font-medium">{selectedIncident.title}</h3>
                <p className="text-gray-600">{selectedIncident.description}</p>
                
                <div className="flex flex-wrap gap-3">
                  {getSeverityBadge(selectedIncident.severity)}
                  {getStatusBadge(selectedIncident.status)}
                  <Badge variant="outline">{selectedIncident.category}</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Fecha:</span>{' '}
                    {format(new Date(selectedIncident.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </div>
                  {selectedIncident.location && (
                    <div>
                      <span className="font-medium">Ubicación:</span> {selectedIncident.location}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-3 border-t pt-4">
                 <div className="space-y-2">
                   <Label htmlFor="incidentStatus">Estado de la incidencia</Label>
                   <Select value={incidentStatus} onValueChange={setIncidentStatus}>
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="open">Abierta</SelectItem>
                       <SelectItem value="in_progress">En progreso</SelectItem>
                       <SelectItem value="resolved">Resuelta</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>

                 <div className="space-y-2">
                   <Label htmlFor="assignedTo">Asignar a</Label>
                   <Select value={assignedTo} onValueChange={setAssignedTo}>
                     <SelectTrigger>
                       <SelectValue placeholder="Seleccionar responsable" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="">Sin asignar</SelectItem>
                       {cleaners.map((cleaner) => (
                         <SelectItem key={cleaner.id} value={cleaner.id}>
                           {cleaner.name}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
                 
                 <div className="space-y-2">
                   <Label htmlFor="resolutionNotes">Notas de resolución</Label>
                   <Textarea
                     id="resolutionNotes"
                     value={resolutionNotes}
                     onChange={(e) => setResolutionNotes(e.target.value)}
                     placeholder="Describe las acciones tomadas para resolver la incidencia..."
                     rows={4}
                   />
                 </div>
              </div>
              
               <div className="flex gap-2 pt-4">
                 <Button 
                   onClick={handleUpdateIncident}
                   disabled={isUpdating}
                 >
                   <Save className="h-4 w-4 mr-2" />
                   {isUpdating ? 'Guardando...' : 'Actualizar Incidencia'}
                 </Button>
                 <Button variant="outline" onClick={() => setShowIncidentModal(false)}>
                   Cancelar
                 </Button>
               </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};