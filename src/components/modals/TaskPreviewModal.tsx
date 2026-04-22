import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Clock, Bed, Bath, Calendar, User, FileText, Edit, UserPlus, ExternalLink, StickyNote } from 'lucide-react';
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
  const { userRole } = useAuth();
  const { isMobile } = useDeviceType();
  const { data: existingReport } = useTaskReport(task?.id || '');
  const { property } = useTaskPreview(task);

  if (!task) return null;

  const isCleaner = userRole === 'cleaner';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Completada';
      case 'in-progress': return 'En Progreso';
      default: return 'Pendiente';
    }
  };

  const getStatusGradient = (status: string) => {
    switch (status) {
      case 'completed': return 'from-green-400 to-green-600';
      case 'in-progress': return 'from-blue-400 to-blue-600';
      default: return 'from-amber-400 to-orange-500';
    }
  };

  const formatTime = (time: string) => time.split(':').slice(0, 2).join(':');

  const calculateDuration = () => {
    const [startHour, startMinute] = task.startTime.split(':').map(Number);
    const [endHour, endMinute] = task.endTime.split(':').map(Number);
    const durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
    if (durationMinutes >= 60) {
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${durationMinutes}m`;
  };

  const today = new Date();
  const taskDate = new Date(task.date + 'T00:00:00');
  const isTaskFromToday = taskDate.toDateString() === today.toDateString();
  const canEditTask = ['admin', 'manager'].includes(userRole || '');
  const canAssignCleaner = ['admin', 'manager'].includes(userRole || '');
  const hasReport = !!existingReport;

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.address)}`;

  const getModalClasses = () => {
    if (isMobile) return "w-full max-w-full h-full max-h-full m-0 rounded-none p-0";
    return "max-w-2xl";
  };

  // ─── Cleaner-specific simplified view ───
  if (isCleaner) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={`${getModalClasses()} ${isMobile ? 'flex flex-col bg-gradient-to-br from-slate-50 to-blue-50/30' : ''}`} aria-describedby="task-preview-description">
          
          {/* Hero header with gradient matching task status */}
          <div className={`bg-gradient-to-br ${getStatusGradient(task.status)} p-6 ${isMobile ? 'pt-12' : 'rounded-t-lg -mx-6 -mt-6 px-6'} relative overflow-hidden`}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20"></div>
            <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/5 rounded-full translate-y-14 -translate-x-14"></div>
            
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-2xl font-bold text-white leading-tight flex-1 pr-3">
                  {task.property}
                </h2>
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm font-semibold shadow-sm">
                  {getStatusText(task.status)}
                </Badge>
              </div>
              {task.propertyCode && (
                <p className="text-white/70 text-sm font-medium" id="task-preview-description">
                  Código: {task.propertyCode}
                </p>
              )}
            </div>
          </div>

          {/* Content */}
          <div className={`${isMobile ? 'flex-1 overflow-y-auto px-5 pb-4' : ''} space-y-4 ${isMobile ? '' : 'pt-4'}`}>
            
            {/* Address + Maps link */}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-2xl bg-white shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-200 transition-all active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 leading-snug">{task.address}</p>
                <p className="text-xs text-blue-500 font-medium mt-0.5 flex items-center gap-1">
                  Abrir en Maps <ExternalLink className="h-3 w-3" />
                </p>
              </div>
            </a>

            {/* Time block */}
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-white shadow-sm border border-slate-100">
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-slate-800">{formatTime(task.startTime)}</span>
                <span className="text-slate-300">—</span>
                <span className="text-lg font-bold text-slate-800">{formatTime(task.endTime)}</span>
                <span className="px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full text-xs font-bold">
                  {calculateDuration()}
                </span>
              </div>
            </div>

            {/* Notas del piso */}
            {property?.notas && (
              <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center">
                    <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <h3 className="font-semibold text-sm text-slate-700">Notas del piso</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed bg-amber-50/50 p-3 rounded-xl">
                  {property.notas}
                </p>
              </div>
            )}

            {/* Notas de la tarea */}
            {task.notes && (
              <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                  </div>
                  <h3 className="font-semibold text-sm text-slate-700">Notas de la tarea</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap bg-blue-50/50 p-3 rounded-xl">
                  {task.notes}
                </p>
              </div>
            )}
          </div>

          {/* Sticky bottom action */}
          <div className={`${isMobile ? 'px-5 pb-6 pt-3' : 'pt-4 border-t'} flex-shrink-0`}>
            {hasReport ? (
              <Button
                onClick={() => { onViewReport?.(task); onOpenChange(false); }}
                className="w-full h-14 text-base font-semibold rounded-2xl shadow-lg"
                disabled={!isTaskFromToday}
              >
                Ver Reporte
              </Button>
            ) : (
              <Button
                onClick={() => { onCreateReport?.(task); onOpenChange(false); }}
                className={`w-full h-14 text-base font-semibold rounded-2xl shadow-lg bg-gradient-to-r ${getStatusGradient(task.status)} hover:opacity-90 border-0`}
                disabled={!isTaskFromToday}
              >
                {isTaskFromToday ? "Comenzar Reporte" : "Tarea Futura"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Manager/Admin full view (unchanged) ───
  const renderActionButtons = () => {
    const buttons = [];

    if (canEditTask) {
      buttons.push(
        <Button key="edit-task" variant="outline" onClick={() => { onEditTask?.(task); onOpenChange(false); }} className="flex-1">
          <Edit className="h-4 w-4 mr-2" />
          Editar Tarea
        </Button>
      );
      if (hasReport) {
        buttons.push(
          <Button key="view-report-manager" variant="outline" onClick={() => { onViewReport?.(task); onOpenChange(false); }} className="flex-1">
            <FileText className="h-4 w-4 mr-2" />
            Ver Reporte
          </Button>
        );
      }
    }

    if (canAssignCleaner && !task.cleanerId) {
      buttons.push(
        <Button key="assign-cleaner" variant="outline" onClick={() => { onAssignCleaner?.(task); onOpenChange(false); }} className="flex-1">
          <UserPlus className="h-4 w-4 mr-2" />
          Asignar Cleaner
        </Button>
      );
    }

    return buttons;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Card className="bg-gradient-to-br from-card to-card/50 border-0 shadow-lg">
            <CardContent className="p-4 space-y-3">
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-start space-x-3 p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-primary/5 transition-colors">
                <div className="p-2 rounded-lg bg-primary/10 text-primary"><MapPin className="h-5 w-5" /></div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{task.address}</p>
                  <p className="text-xs text-primary mt-1">Abrir en Google Maps →</p>
                </div>
              </a>

              <div className="flex items-center space-x-3 p-3 rounded-xl bg-accent/20 border border-accent/30">
                <div className="p-2 rounded-lg bg-accent text-accent-foreground"><Clock className="h-5 w-5" /></div>
                <p className="text-sm font-medium text-foreground">
                  {formatTime(task.startTime)} - {formatTime(task.endTime)}
                  <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-semibold">{calculateDuration()}</span>
                </p>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="p-2 rounded-lg bg-secondary/80 text-secondary-foreground"><Calendar className="h-5 w-5" /></div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Fecha</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(task.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>

              {task.cleaner && (
                <div className="flex items-center space-x-3 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400"><User className="h-5 w-5" /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Asignado a</p>
                    <p className="text-sm text-green-700 dark:text-green-400 mt-1 font-medium">{task.cleaner}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {property?.notas && (
            <Card className="bg-gradient-to-br from-card to-card/50 border-0 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm text-foreground">Notas del piso</h3>
                </div>
                <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">{property.notas}</p>
              </CardContent>
            </Card>
          )}

          {task.notes && (
            <Card className="bg-gradient-to-br from-card to-card/50 border-0 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm text-foreground">Notas de la Tarea</h3>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-lg border border-border/50">{task.notes}</p>
              </CardContent>
            </Card>
          )}

          {property && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="font-semibold text-base">Detalles de la Propiedad</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3"><Bed className="h-5 w-5 text-muted-foreground" /><div><p className="font-medium">{property.numeroCamas}</p><p className="text-xs text-muted-foreground">Camas Grandes</p></div></div>
                  <div className="flex items-center space-x-3"><Bath className="h-5 w-5 text-muted-foreground" /><div><p className="font-medium">{property.numeroBanos}</p><p className="text-xs text-muted-foreground">Baños</p></div></div>
                  {(property.numeroCamasPequenas > 0) && <div className="flex items-center space-x-3"><Bed className="h-4 w-4 text-muted-foreground" /><div><p className="font-medium">{property.numeroCamasPequenas}</p><p className="text-xs text-muted-foreground">Camas Pequeñas</p></div></div>}
                  {(property.numeroCamasSuite > 0) && <div className="flex items-center space-x-3"><Bed className="h-4 w-4 text-muted-foreground" /><div><p className="font-medium">{property.numeroCamasSuite}</p><p className="text-xs text-muted-foreground">Camas Suite</p></div></div>}
                  {(property.numeroSofasCama > 0) && <div className="flex items-center space-x-3"><span className="text-lg">🛋️</span><div><p className="font-medium">{property.numeroSofasCama}</p><p className="text-xs text-muted-foreground">Sofás Cama</p></div></div>}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="font-medium">Duración</p><p className="text-muted-foreground">{property.duracionServicio} min</p></div>
                  <div><p className="font-medium">Check-in / Check-out</p><p className="text-muted-foreground">{formatTime(task.checkIn)} / {formatTime(task.checkOut)}</p></div>
                </div>
                {property.notas && <div><p className="font-medium">Notas especiales</p><p className="text-sm text-muted-foreground bg-muted p-3 rounded-md mt-1">{property.notas}</p></div>}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-base">Información del Servicio</h3>
              <div className="grid grid-cols-1 gap-3 text-sm">
                {['admin', 'manager'].includes(userRole || '') && (
                  <>
                    <div className="flex justify-between"><span className="font-medium">Tipo de servicio:</span><span className="text-muted-foreground">{task.type}</span></div>
                    {task.cost && <div className="flex justify-between"><span className="font-medium">Coste:</span><span className="text-muted-foreground">€{task.cost}</span></div>}
                  </>
                )}
                {task.supervisor && <div className="flex justify-between"><span className="font-medium">Supervisor:</span><span className="text-muted-foreground">{task.supervisor}</span></div>}
                {property && (
                  <>
                    <div className="border-t pt-3 mt-3">
                      <h4 className="font-medium mb-2">Información Textil</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between"><span>Sábanas:</span><span className="text-muted-foreground">{property.numeroSabanas}</span></div>
                        {(property.numeroSabanasRequenas > 0) && <div className="flex justify-between"><span>Sábanas pequeñas:</span><span className="text-muted-foreground">{property.numeroSabanasRequenas}</span></div>}
                        {(property.numeroSabanasSuite > 0) && <div className="flex justify-between"><span>Sábanas suite:</span><span className="text-muted-foreground">{property.numeroSabanasSuite}</span></div>}
                        <div className="flex justify-between"><span>Toallas grandes:</span><span className="text-muted-foreground">{property.numeroToallasGrandes}</span></div>
                        <div className="flex justify-between"><span>Toallas pequeñas:</span><span className="text-muted-foreground">{property.numeroTotallasPequenas}</span></div>
                        <div className="flex justify-between"><span>Alfombrines:</span><span className="text-muted-foreground">{property.numeroAlfombrines}</span></div>
                        <div className="flex justify-between"><span>Fundas almohada:</span><span className="text-muted-foreground">{property.numeroFundasAlmohada}</span></div>
                        <div className="flex justify-between"><span>Kit alimentario:</span><span className="text-muted-foreground">{property.kitAlimentario}</span></div>
                        <div className="flex justify-between"><span>🧻 Papel higiénico:</span><span className="text-muted-foreground">{property.cantidadRollosPapelHigienico || 0}</span></div>
                        <div className="flex justify-between"><span>🧾 Papel cocina:</span><span className="text-muted-foreground">{property.cantidadRollosPapelCocina || 0}</span></div>
                      </div>
                    </div>
                    <div className="border-t pt-3">
                      <h4 className="font-medium mb-2">Amenities</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between"><span>Amenities baño:</span><span className="text-muted-foreground">{property.amenitiesBano}</span></div>
                        <div className="flex justify-between"><span>Amenities cocina:</span><span className="text-muted-foreground">{property.amenitiesCocina}</span></div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t flex-shrink-0">
          {renderActionButtons()}
        </div>
      </DialogContent>
    </Dialog>
  );
};
