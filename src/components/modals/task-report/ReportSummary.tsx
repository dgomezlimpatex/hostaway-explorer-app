
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CheckCircle, 
  Clock, 
} from 'lucide-react';
import { Task } from '@/types/calendar';
import { TaskChecklistTemplate, TaskReport } from '@/types/taskReports';

interface ReportSummaryProps {
  task: Task;
  template: TaskChecklistTemplate | undefined;
  checklist: Record<string, any>;
  notes: string;
  completionPercentage: number;
  currentReport?: TaskReport;
}

export const ReportSummary: React.FC<ReportSummaryProps> = ({
  task,
  template,
  checklist,
  notes,
  completionPercentage,
  currentReport,
}) => {
  const totalItems = template?.checklist_items?.reduce(
    (acc, category) => acc + category.items.length, 
    0
  ) || 0;
  
  const completedItems = Object.keys(checklist).length;
  const totalPhotos = Object.values(checklist).reduce(
    (acc: number, item: any) => acc + (item?.media_urls?.length || 0),
    0
  );

  const getCompletionStatus = () => {
    if (completionPercentage === 100) return { text: 'Completado', color: 'bg-green-500' };
    if (completionPercentage >= 80) return { text: 'Casi completo', color: 'bg-blue-500' };
    if (completionPercentage >= 50) return { text: 'En progreso', color: 'bg-yellow-500' };
    return { text: 'Iniciado', color: 'bg-gray-500' };
  };

  const status = getCompletionStatus();

  // Función para formatear tiempo
  const formatTime = (dateString?: string) => {
    if (!dateString) return 'No registrado';
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  // Calcular duración del servicio
  const calculateServiceDuration = () => {
    if (!currentReport?.start_time) return 'No iniciado';
    
    const startTime = new Date(currentReport.start_time);
    
    // Si el reporte está completado y tiene end_time, usar solo ese tiempo
    if (currentReport.overall_status === 'completed' && currentReport.end_time) {
      const endTime = new Date(currentReport.end_time);
      const diffInMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 60) {
        return `${diffInMinutes} minutos`;
      } else {
        const hours = Math.floor(diffInMinutes / 60);
        const minutes = diffInMinutes % 60;
        return `${hours}h ${minutes}m`;
      }
    }
    
    // Si no está completado, calcular tiempo en curso
    if (!currentReport.end_time) {
      const currentTime = new Date();
      const diffInMinutes = Math.floor((currentTime.getTime() - startTime.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 60) {
        return `${diffInMinutes} minutos`;
      } else {
        const hours = Math.floor(diffInMinutes / 60);
        const minutes = diffInMinutes % 60;
        return `${hours}h ${minutes}m`;
      }
    }
    
    // Fallback: usar end_time si existe
    const endTime = new Date(currentReport.end_time);
    const diffInMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutos`;
    } else {
      const hours = Math.floor(diffInMinutes / 60);
      const minutes = diffInMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tiempo real del servicio */}
      {currentReport && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-md flex items-center">
              <Clock className="h-4 w-4 mr-2 text-blue-500" />
              Tiempo Real del Servicio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Hora de Inicio</p>
                <p className="text-lg font-semibold text-green-700">
                  {formatTime(currentReport.start_time)}
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  {currentReport.end_time ? 'Hora de Finalización' : 'Tiempo Transcurrido'}
                </p>
                <p className="text-lg font-semibold text-red-700">
                  {currentReport.end_time ? formatTime(currentReport.end_time) : 'En curso'}
                </p>
              </div>
            </div>
            
            <div className="text-center pt-2 border-t border-blue-200">
              <p className="text-sm text-muted-foreground mb-1">Duración del Servicio</p>
              <p className="text-xl font-bold text-blue-700">
                {calculateServiceDuration()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado final */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="text-center">
            <CheckCircle className="h-14 w-14 mx-auto mb-3 text-green-500" />
            <h3 className="text-lg font-semibold text-green-700 mb-1">
              Reporte Finalizado
            </h3>
            <p className="text-sm text-muted-foreground">
              Todas las tareas han sido completadas.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
