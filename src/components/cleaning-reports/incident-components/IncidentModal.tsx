import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, MessageSquare, Save } from 'lucide-react';
import { getSeverityBadge, getStatusBadge } from './IncidentBadges';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface IncidentModalProps {
  showIncidentModal: boolean;
  setShowIncidentModal: (show: boolean) => void;
  selectedIncident: any;
  incidentStatus: string;
  setIncidentStatus: (status: string) => void;
  resolutionNotes: string;
  setResolutionNotes: (notes: string) => void;
  assignedTo: string;
  setAssignedTo: (assigned: string) => void;
  cleaners: any[];
  reportMedia: any[];
  handleUpdateIncident: () => void;
  isUpdating: boolean;
}

export const IncidentModal: React.FC<IncidentModalProps> = ({
  showIncidentModal,
  setShowIncidentModal,
  selectedIncident,
  incidentStatus,
  setIncidentStatus,
  resolutionNotes,
  setResolutionNotes,
  assignedTo,
  setAssignedTo,
  cleaners,
  reportMedia,
  handleUpdateIncident,
  isUpdating,
}) => {
  return (
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

            {/* Imágenes asociadas a la incidencia */}
            {reportMedia && reportMedia.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Evidencias fotográficas ({reportMedia.length})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {reportMedia.map((media: any) => (
                    <div key={media.id} className="relative group">
                      <img
                        src={media.file_url}
                        alt={media.description || 'Evidencia de incidencia'}
                        className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(media.file_url, '_blank')}
                      />
                      {media.description && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          {media.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
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
                    <SelectItem value="unassigned">Sin asignar</SelectItem>
                    {cleaners.filter(cleaner => cleaner.name && cleaner.name.trim()).map((cleaner) => (
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
  );
};