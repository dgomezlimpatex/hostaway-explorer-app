
import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RequiredValidation {
  isValid: boolean;
  missingItems: string[];
  missingPhotos: string[];
}

interface TaskReportFooterProps {
  onCancel: () => void;
  onSave: () => void;
  onComplete: () => void;
  onStartTask: () => void;
  canComplete: boolean;
  isCreatingReport: boolean;
  isUpdatingReport: boolean;
  completionPercentage: number;
  requiredValidation: RequiredValidation;
  isTaskFromToday: boolean;
  isTaskCompleted?: boolean;
  hasStartedTask: boolean;
  currentStep?: 'checklist' | 'issues' | 'media' | 'summary';
}

export const TaskReportFooter: React.FC<TaskReportFooterProps> = ({
  onCancel,
  onSave,
  onComplete,
  onStartTask,
  canComplete,
  isCreatingReport,
  isUpdatingReport,
  completionPercentage,
  requiredValidation,
  isTaskFromToday,
  isTaskCompleted = false,
  hasStartedTask,
  currentStep
}) => {
  const { toast } = useToast();

  const handleComplete = () => {
    if (!isTaskFromToday) {
      toast({
        title: "Error",
        description: "Solo puedes completar tareas del día de hoy.",
        variant: "destructive",
      });
      return;
    }
    
    if (!requiredValidation.isValid) {
      const messages = [];
      if (requiredValidation.missingItems.length > 0) {
        messages.push(`Tareas obligatorias pendientes: ${requiredValidation.missingItems.join(', ')}`);
      }
      if (requiredValidation.missingPhotos.length > 0) {
        messages.push(`Fotos obligatorias: ${requiredValidation.missingPhotos.join(', ')}`);
      }
      
      toast({
        title: "Reporte incompleto",
        description: messages.join('. '),
        variant: "destructive",
      });
      return;
    }
    
    onComplete();
  };

  return (
    <div className="border-t pt-4 flex items-center justify-between gap-2">
      <Button variant="outline" onClick={onCancel} size="sm" className="text-xs px-3 py-1 h-8">
        {isTaskCompleted ? "Cerrar" : "Cancelar"}
      </Button>
      
      <div className="flex items-center gap-2 flex-wrap">
        {/* Botón de Iniciar Tarea - solo visible si no ha empezado */}
        {!hasStartedTask && !isTaskCompleted && (
          <Button
            onClick={onStartTask}
            disabled={!isTaskFromToday || isCreatingReport}
            className="bg-blue-600 hover:bg-blue-700 text-xs px-3 py-1 h-8"
            size="sm"
            title={!isTaskFromToday ? "Solo puedes iniciar tareas de hoy" : "Iniciar tarea"}
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            {isCreatingReport ? 'Iniciando...' : 'Iniciar'}
          </Button>
        )}

        {/* Botones de guardar y completar - solo visible si ha empezado */}
        {hasStartedTask && !isTaskCompleted && (
          <>
            <Button
              variant="outline"
              onClick={onSave}
              disabled={isCreatingReport || isUpdatingReport}
              size="sm"
              className="text-xs px-3 py-1 h-8"
            >
              <Save className="h-3 w-3 mr-1" />
              {isCreatingReport || isUpdatingReport ? 'Guardando...' : 'Guardar'}
            </Button>
            
            {/* Botón de completar - solo visible en la pantalla summary */}
            {currentStep === 'summary' && (
              <Button
                onClick={handleComplete}
                disabled={!canComplete || isCreatingReport || isUpdatingReport}
                className={`text-xs px-3 py-1 h-8 ${canComplete ? 'bg-green-600 hover:bg-green-700' : ''}`}
                size="sm"
                title={
                  !isTaskFromToday ? "Solo puedes completar tareas de hoy" :
                  !requiredValidation.isValid ? "Faltan tareas o fotos obligatorias" :
                  "Completar reporte"
                }
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Completar
              </Button>
            )}
          </>
        )}

        {/* Botón de guardar cambios para tareas completadas */}
        {isTaskCompleted && (
          <Button
            onClick={onSave}
            disabled={isCreatingReport || isUpdatingReport}
            size="sm"
            className="text-xs px-3 py-1 h-8"
          >
            <Save className="h-3 w-3 mr-1" />
            {isCreatingReport || isUpdatingReport ? 'Guardando...' : 'Guardar'}
          </Button>
        )}
        
        {/* Mensajes de validación */}
        {hasStartedTask && !canComplete && !isTaskCompleted && (
          <div className="text-xs text-muted-foreground mt-1">
            {!isTaskFromToday && "⚠️ Solo tareas de hoy"}
            {isTaskFromToday && !requiredValidation.isValid && (
              <div>
                {requiredValidation.missingItems.length > 0 && (
                  <div>• Faltan {requiredValidation.missingItems.length} tareas obligatorias</div>
                )}
                {requiredValidation.missingPhotos.length > 0 && (
                  <div>• Faltan {requiredValidation.missingPhotos.length} fotos obligatorias</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
