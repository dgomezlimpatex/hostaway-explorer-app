import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Calendar, MapPin, User, UserPlus, Building2, Clock } from 'lucide-react';
import { getSeverityBadge, getStatusBadge } from './IncidentBadges';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface IncidentsListProps {
  incidents: any[];
  cleaners: any[];
  onIncidentClick: (incident: any) => void;
}

export const IncidentsList: React.FC<IncidentsListProps> = ({
  incidents,
  cleaners,
  onIncidentClick,
}) => {
  return (
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
                onClick={() => onIncidentClick(incident)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">{incident.title}</h4>
                      {getSeverityBadge(incident.severity)}
                      {getStatusBadge(incident.status)}
                    </div>
                    
                    {/* Información de la propiedad y tarea */}
                    <div className="flex items-center gap-4 mb-2 text-sm">
                      <div className="flex items-center gap-1 text-blue-600">
                        <Building2 className="h-4 w-4" />
                        <span className="font-medium">{incident.propertyName}</span>
                        {incident.propertyCode && (
                          <span className="text-gray-500">({incident.propertyCode})</span>
                        )}
                      </div>
                      {incident.taskDate && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>{format(new Date(incident.taskDate), 'dd/MM/yyyy', { locale: es })}</span>
                        </div>
                      )}
                      {incident.taskStartTime && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <Clock className="h-4 w-4" />
                          <span>{incident.taskStartTime}</span>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">{incident.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(incident.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="font-medium">
                      {cleaners.find(c => c.id === incident.cleanerId)?.name || 'Limpiador no encontrado'}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                    {incident.category}
                  </Badge>
                  {incident.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {incident.location}
                    </div>
                  )}
                  {incident.assignedTo && incident.assignedTo !== 'unassigned' && (
                    <div className="flex items-center gap-1">
                      <UserPlus className="h-3 w-3" />
                      <span className="text-green-600">
                        Asignado a: {cleaners.find(c => c.id === incident.assignedTo)?.name || incident.assignedTo}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};