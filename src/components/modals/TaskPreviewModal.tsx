import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Clock, Bed, Bath, Calendar, User, FileText, Edit, UserPlus, Camera, CheckCircle } from 'lucide-react';
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
  onViewReport
}) => {
  const {
    userRole
  } = useAuth();
  const {
    isMobile
  } = useDeviceType();
  const {
    data: existingReport
  } = useTaskReport(task?.id || '');
  const {
    property
  } = useTaskPreview(task);
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

  // Check if task is from today - stricter validation
  const today = new Date();
  const taskDate = new Date(task.date + 'T00:00:00');
  const isTaskFromToday = taskDate.toDateString() === today.toDateString();
  const canCreateReport = userRole === 'cleaner' && task.cleanerId && isTaskFromToday;
  const canEditTask = ['admin', 'manager', 'supervisor'].includes(userRole || '');
  const canAssignCleaner = ['admin', 'manager', 'supervisor'].includes(userRole || '');
  const hasReport = !!existingReport;
  const renderActionButtons = () => {
    const buttons = [];

    // Botón principal según el rol y estado
    if (userRole === 'cleaner' && task.cleanerId) {
      if (hasReport) {
        buttons.push(<Button key="view-report" onClick={() => {
          onViewReport?.(task);
          onOpenChange(false);
        }} className="flex-1" disabled={!isTaskFromToday} title={!isTaskFromToday ? "Solo puedes ver reportes de tareas de hoy" : ""}>
            <FileText className="h-4 w-4 mr-2" />
            Ver Reporte
          </Button>);
      } else {
        buttons.push(<Button key="create-report" onClick={() => {
          onCreateReport?.(task);
          onOpenChange(false);
        }} className="flex-1" disabled={!isTaskFromToday} title={!isTaskFromToday ? "Solo puedes crear reportes para tareas de hoy" : ""}>
            <Camera className="h-4 w-4 mr-2" />
            {isTaskFromToday ? "Comenzar Reporte" : "Tarea Futura"}
          </Button>);
      }
    }

    // Botones para managers/supervisors (NO para cleaners)
    if (canEditTask && userRole !== 'cleaner') {
      buttons.push(<Button key="edit-task" variant="outline" onClick={() => {
        onEditTask?.(task);
        onOpenChange(false);
      }} className={canCreateReport ? "flex-1" : "flex-1"}>
          <Edit className="h-4 w-4 mr-2" />
          Editar Tarea
        </Button>);
      if (hasReport) {
        buttons.push(<Button key="view-report-manager" variant="outline" onClick={() => {
          onViewReport?.(task);
          onOpenChange(false);
        }} className="flex-1">
            <FileText className="h-4 w-4 mr-2" />
            Ver Reporte
          </Button>);
      }
    }

    // Asignar cleaner solo para managers/supervisors (NO para cleaners)
    if (canAssignCleaner && !task.cleanerId && userRole !== 'cleaner') {
      buttons.push(<Button key="assign-cleaner" variant="outline" onClick={() => {
        onAssignCleaner?.(task);
        onOpenChange(false);
      }} className="flex-1">
          <UserPlus className="h-4 w-4 mr-2" />
          Asignar Cleaner
        </Button>);
    }
    return buttons;
  };
  const getModalClasses = () => {
    if (isMobile) {
      return "w-full max-w-full h-full max-h-full m-0 rounded-none";
    }
    return "max-w-2xl";
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${getModalClasses()} ${isMobile ? 'flex flex-col' : ''}`} aria-describedby="task-preview-description">
        <DialogHeader className="flex-shrink-0 relative">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold text-left bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                {task.property}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-2 font-medium" id="task-preview-description">
                Código: {task.propertyCode || 'N/A'}
              </p>
            </div>
            <Badge className={`${getStatusColor(task.status)} shadow-sm font-semibold px-3 py-1`}>
              {getStatusText(task.status)}
            </Badge>
          </div>
          <div className="absolute -bottom-4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
        </DialogHeader>

        <div className={`${isMobile ? 'flex-1 overflow-y-auto' : ''} space-y-4 pt-2`}>
          {/* Información básica */}
          <Card className="bg-gradient-to-br from-card to-card/50 border-0 shadow-lg">
            <CardContent className="p-5 space-y-5">
              <div className="flex items-start space-x-4 p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Dirección</p>
                  <p className="text-sm text-muted-foreground mt-1">{task.address}</p>
                </div>
              </div>

              <div className="flex items-center space-x-4 p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="p-2 rounded-lg bg-secondary/80 text-secondary-foreground">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Fecha</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(task.date).toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4 p-3 rounded-xl bg-accent/20 border border-accent/30">
                <div className="p-2 rounded-lg bg-accent text-accent-foreground">
                  <Clock className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Horario</p>
                  <p className="text-sm text-muted-foreground mt-1 font-medium">
                    {formatTime(task.startTime)} - {formatTime(task.endTime)} 
                    <span className="ml-2 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">
                      {calculateDuration()}
                    </span>
                  </p>
                </div>
              </div>

              {task.cleaner && (
                <div className="flex items-center space-x-4 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Asignado a</p>
                    <p className="text-sm text-green-700 dark:text-green-400 mt-1 font-medium">{task.cleaner}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notas de la tarea */}
          {task.notes && (
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 border-orange-200 dark:border-orange-800/50 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-lg text-orange-800 dark:text-orange-300">Notas de la Tarea</h3>
                </div>
                <div className="text-sm text-foreground whitespace-pre-wrap bg-background/80 p-4 rounded-xl border border-orange-200/50 dark:border-orange-800/30 shadow-sm">
                  {task.notes}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detalles de la propiedad */}
          {property && <Card>
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
                    <p className="font-medium">Duración </p>
                    <p className="text-muted-foreground">{property.duracionServicio} min</p>
                  </div>
                  <div>
                    <p className="font-medium">Check-in / Check-out</p>
                    <p className="text-muted-foreground">
                      {formatTime(task.checkIn)} / {formatTime(task.checkOut)}
                    </p>
                  </div>
                </div>

                {property.notas && <div>
                    <p className="font-medium">Notas especiales</p>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md mt-1">
                      {property.notas}
                    </p>
                  </div>}
              </CardContent>
            </Card>}

          {/* Información del servicio */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-base">Información del Servicio</h3>
              
              <div className="grid grid-cols-1 gap-3 text-sm">
                {['admin', 'manager'].includes(userRole || '') && <>
                    <div className="flex justify-between">
                      <span className="font-medium">Tipo de servicio:</span>
                      <span className="text-muted-foreground">{task.type}</span>
                    </div>
                    {task.cost && <div className="flex justify-between">
                        <span className="font-medium">Coste:</span>
                        <span className="text-muted-foreground">€{task.cost}</span>
                      </div>}
                  </>}
                {task.supervisor && <div className="flex justify-between">
                    <span className="font-medium">Supervisor:</span>
                    <span className="text-muted-foreground">{task.supervisor}</span>
                  </div>}
                
                {/* Información textil y amenities */}
                {property && (
                  <>
                    <div className="border-t pt-3 mt-3">
                      <h4 className="font-medium mb-2">Información Textil</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span>Sábanas:</span>
                          <span className="text-muted-foreground">{property.numeroSabanas}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Toallas grandes:</span>
                          <span className="text-muted-foreground">{property.numeroToallasGrandes}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Toallas pequeñas:</span>
                          <span className="text-muted-foreground">{property.numeroTotallasPequenas}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Alfombrines:</span>
                          <span className="text-muted-foreground">{property.numeroAlfombrines}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fundas almohada:</span>
                          <span className="text-muted-foreground">{property.numeroFundasAlmohada}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Kit alimentario:</span>
                          <span className="text-muted-foreground">{property.kitAlimentario}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t pt-3">
                      <h4 className="font-medium mb-2">Amenities</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span>Amenities baño:</span>
                          <span className="text-muted-foreground">{property.amenitiesBano}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Amenities cocina:</span>
                          <span className="text-muted-foreground">{property.amenitiesCocina}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t flex-shrink-0">
          {renderActionButtons()}
        </div>
      </DialogContent>
    </Dialog>;
};