import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  MapPin, 
  Clock, 
  Bed, 
  Bath, 
  Calendar,
  User,
  FileText,
  Edit,
  UserPlus,
  Camera,
  CheckCircle
} from 'lucide-react';
import { Task } from '@/types/calendar';
import { Property } from '@/types/property';
import { useAuth } from '@/hooks/useAuth';
import { useDeviceType } from '@/hooks/use-mobile';
import { useTaskReport } from '@/hooks/useTaskReports';
import { useTaskPreview } from '@/hooks/useTaskPreview';

interface TaskPreviewModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateReport?: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  onAssignCleaner?: (task: Task) => void;
  onViewReport?: (task: Task) => void;
}

export const TaskPreviewModal: React.FC<TaskPreviewModalProps> = ({
  task,
  open,
  onOpenChange,
  onCreateReport,
  onEditTask,
  onAssignCleaner,
  onViewReport,
}) => {
  const { userRole } = useAuth();
  const { isMobile } = useDeviceType();
  const { data: existingReport } = useTaskReport(task?.id || '');
  const { property } = useTaskPreview(task);

  if (!task) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completada';
      case 'in-progress':
        return 'En Progreso';
      default:
        return 'Pendiente';
    }
  };

  const formatTime = (time: string) => {
    return time.split(':').slice(0, 2).join(':');
  };

  const calculateDuration = () => {
    const [startHour, startMinute] = task.startTime.split(':').map(Number);
    const [endHour, endMinute] = task.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    const durationMinutes = endMinutes - startMinutes;
    
    if (durationMinutes >= 60) {
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${durationMinutes}m`;
  };

  const canCreateReport = userRole === 'cleaner' && task.cleanerId;
  const canEditTask = ['admin', 'manager', 'supervisor'].includes(userRole || '');
  const canAssignCleaner = ['admin', 'manager', 'supervisor'].includes(userRole || '');
  const hasReport = !!existingReport;

  const renderActionButtons = () => {
    const buttons = [];

    // Botón principal según el rol y estado
    if (canCreateReport) {
      if (hasReport) {
        buttons.push(
          <Button
            key="view-report"
            onClick={() => {
              onViewReport?.(task);
              onOpenChange(false);
            }}
            className="flex-1"
          >
            <FileText className="h-4 w-4 mr-2" />
            Ver Reporte
          </Button>
        );
      } else {
        buttons.push(
          <Button
            key="create-report"
            onClick={() => {
              onCreateReport?.(task);
              onOpenChange(false);
            }}
            className="flex-1"
          >
            <Camera className="h-4 w-4 mr-2" />
            Comenzar Reporte
          </Button>
        );
      }
    }

    // Botones para managers/supervisors
    if (canEditTask) {
      buttons.push(
        <Button
          key="edit-task"
          variant="outline"
          onClick={() => {
            onEditTask?.(task);
            onOpenChange(false);
          }}
          className={canCreateReport ? "flex-1" : "flex-1"}
        >
          <Edit className="h-4 w-4 mr-2" />
          Editar Tarea
        </Button>
      );

      if (hasReport) {
        buttons.push(
          <Button
            key="view-report-manager"
            variant="outline"
            onClick={() => {
              onViewReport?.(task);
              onOpenChange(false);
            }}
            className="flex-1"
          >
            <FileText className="h-4 w-4 mr-2" />
            Ver Reporte
          </Button>
        );
      }
    }

    if (canAssignCleaner && !task.cleanerId) {
      buttons.push(
        <Button
          key="assign-cleaner"
          variant="outline"
          onClick={() => {
            onAssignCleaner?.(task);
            onOpenChange(false);
          }}
          className="flex-1"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Asignar Cleaner
        </Button>
      );
    }

    return buttons;
  };

  const getModalClasses = () => {
    if (isMobile) {
      return "w-full max-w-full h-full max-h-full m-0 rounded-none";
    }
    return "max-w-2xl";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={getModalClasses()}>
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold text-left">
                {task.property}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Código: {task.propertyCode || 'N/A'}
              </p>
            </div>
            <Badge className={getStatusColor(task.status)}>
              {getStatusText(task.status)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información básica */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Dirección</p>
                  <p className="text-sm text-muted-foreground">{task.address}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Fecha</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(task.date).toLocaleDateString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Horario</p>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(task.startTime)} - {formatTime(task.endTime)} ({calculateDuration()})
                  </p>
                </div>
              </div>

              {task.cleaner && (
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Asignado a</p>
                    <p className="text-sm text-muted-foreground">{task.cleaner}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detalles de la propiedad */}
          {property && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="font-semibold text-base">Detalles de la Propiedad</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <Bed className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{property.numeroCamas}</p>
                      <p className="text-xs text-muted-foreground">Camas</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Bath className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{property.numeroBanos}</p>
                      <p className="text-xs text-muted-foreground">Baños</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Duración estimada</p>
                    <p className="text-muted-foreground">{property.duracionServicio} min</p>
                  </div>
                  <div>
                    <p className="font-medium">Check-in / Check-out</p>
                    <p className="text-muted-foreground">
                      {formatTime(task.checkIn)} / {formatTime(task.checkOut)}
                    </p>
                  </div>
                </div>

                {property.notas && (
                  <div>
                    <p className="font-medium">Notas especiales</p>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md mt-1">
                      {property.notas}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Información del servicio */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-base">Información del Servicio</h3>
              
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Tipo de servicio:</span>
                  <span className="text-muted-foreground">{task.type}</span>
                </div>
                {task.cost && (
                  <div className="flex justify-between">
                    <span className="font-medium">Coste:</span>
                    <span className="text-muted-foreground">€{task.cost}</span>
                  </div>
                )}
                {task.supervisor && (
                  <div className="flex justify-between">
                    <span className="font-medium">Supervisor:</span>
                    <span className="text-muted-foreground">{task.supervisor}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          {renderActionButtons()}
        </div>
      </DialogContent>
    </Dialog>
  );
};