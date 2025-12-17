import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Calendar, Clock, MapPin } from "lucide-react";
import { WorkerConflict } from "@/types/workerAbsence";
import { ABSENCE_TYPE_LABELS, ABSENCE_TYPE_COLORS } from "@/types/workerAbsence";

interface ConflictWarningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerName: string;
  conflicts: WorkerConflict[];
  taskInfo: {
    property: string;
    date: string;
    startTime: string;
    endTime: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConflictWarningModal = ({
  open,
  onOpenChange,
  workerName,
  conflicts,
  taskInfo,
  onConfirm,
  onCancel,
}: ConflictWarningModalProps) => {
  const getConflictIcon = (type: string) => {
    switch (type) {
      case 'fixed_day_off':
        return <Calendar className="h-4 w-4" />;
      case 'maintenance':
        return <MapPin className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getConflictColor = (type: string): string => {
    if (type === 'fixed_day_off') return '#6B7280';
    if (type === 'maintenance') return '#EAB308';
    return ABSENCE_TYPE_COLORS[type as keyof typeof ABSENCE_TYPE_COLORS] || '#6B7280';
  };

  const getConflictLabel = (type: string): string => {
    if (type === 'fixed_day_off') return 'Día libre fijo';
    if (type === 'maintenance') return 'Limpieza de mantenimiento';
    return ABSENCE_TYPE_LABELS[type as keyof typeof ABSENCE_TYPE_LABELS] || type;
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Conflicto de Disponibilidad
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                El trabajador <span className="font-semibold text-foreground">{workerName}</span> tiene los siguientes conflictos:
              </p>
              
              <div className="space-y-2">
                {conflicts.map((conflict, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50"
                    style={{ borderLeftColor: getConflictColor(conflict.type), borderLeftWidth: '4px' }}
                  >
                    <div 
                      className="p-1.5 rounded-full"
                      style={{ backgroundColor: `${getConflictColor(conflict.type)}20` }}
                    >
                      {getConflictIcon(conflict.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {getConflictLabel(conflict.type)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {conflict.reason}
                      </div>
                      {conflict.timeRange && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {conflict.timeRange}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Tarea a asignar:</div>
                <div className="font-medium text-sm">{taskInfo.property}</div>
                <div className="text-xs text-muted-foreground">
                  {taskInfo.date} · {taskInfo.startTime} - {taskInfo.endTime}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                ¿Deseas asignar la tarea igualmente?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Asignar de todos modos
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
