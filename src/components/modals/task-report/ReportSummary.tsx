
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  Clock, 
  MapPin, 
  User, 
  AlertTriangle,
  FileText,
  Camera 
} from 'lucide-react';
import { Task } from '@/types/calendar';
import { TaskChecklistTemplate } from '@/types/taskReports';

interface ReportSummaryProps {
  task: Task;
  template: TaskChecklistTemplate | undefined;
  checklist: Record<string, any>;
  issues: any[];
  notes: string;
  completionPercentage: number;
}

export const ReportSummary: React.FC<ReportSummaryProps> = ({
  task,
  template,
  checklist,
  issues,
  notes,
  completionPercentage,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <CheckCircle className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Resumen del Reporte</h3>
      </div>

      {/* Información de la tarea */}
      <Card>
        <CardHeader>
          <CardTitle className="text-md">Información de la Tarea</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <div>
                <p className="font-medium">{task.property}</p>
                <p className="text-sm text-gray-600">{task.address}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <div>
                <p className="font-medium">{task.date}</p>
                <p className="text-sm text-gray-600">{task.startTime} - {task.endTime}</p>
              </div>
            </div>
          </div>

          {task.cleaner && (
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-500" />
              <span className="font-medium">{task.cleaner}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progreso del checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-md">Progreso del Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Completado</span>
            <Badge className={status.color}>
              {status.text}
            </Badge>
          </div>
          
          <Progress value={completionPercentage} className="w-full" />
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{completedItems}</p>
              <p className="text-sm text-gray-600">Completadas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600">{totalItems}</p>
              <p className="text-sm text-gray-600">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{completionPercentage}%</p>
              <p className="text-sm text-gray-600">Progreso</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas adicionales */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Camera className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold">{totalPhotos}</p>
              <p className="text-sm text-gray-600">Fotos</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-orange-500" />
              <p className="text-2xl font-bold">{issues.length}</p>
              <p className="text-sm text-gray-600">Incidencias</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold">{notes.length > 0 ? 1 : 0}</p>
              <p className="text-sm text-gray-600">Notas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Incidencias destacadas */}
      {issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-md flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 text-orange-500" />
              Incidencias Reportadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {issues.map((issue, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                  <span className="text-sm">{issue.description}</span>
                  <Badge variant="outline" className="text-xs">
                    {issue.severity === 'high' ? 'Alto' : issue.severity === 'medium' ? 'Medio' : 'Bajo'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notas */}
      {notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-md flex items-center">
              <FileText className="h-4 w-4 mr-2 text-purple-500" />
              Notas Generales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Estado final */}
      <Card className="border-2 border-dashed">
        <CardContent className="pt-6">
          <div className="text-center">
            {completionPercentage >= 80 ? (
              <>
                <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-semibold text-green-700 mb-2">
                  Reporte Listo para Completar
                </h3>
                <p className="text-sm text-gray-600">
                  El reporte está completo y puede ser finalizado.
                </p>
              </>
            ) : (
              <>
                <Clock className="h-16 w-16 mx-auto mb-4 text-yellow-500" />
                <h3 className="text-lg font-semibold text-yellow-700 mb-2">
                  Reporte en Progreso
                </h3>
                <p className="text-sm text-gray-600">
                  Completa al menos el 80% del checklist para finalizar el reporte.
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
