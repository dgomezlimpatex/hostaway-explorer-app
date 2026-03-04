
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
  onForceSave?: () => void;
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
    <div className="border-t pt-2 space-y-2">
      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onCancel} size="sm" className="text-xs px-3 h-8">
          {isTaskCompleted ? "Cerrar" : "Cancelar"}
        </Button>
        
        <div className="flex items-center gap-2">
          {/* Botón de Iniciar Tarea - solo visible si no ha empezado */}
          {!hasStartedTask && !isTaskCompleted && (
            <Button
              onClick={onStartTask}
              disabled={!isTaskFromToday || isCreatingReport}
              className="bg-blue-600 hover:bg-blue-700 text-xs px-3 h-8"
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
              {/* Guardar solo en pasos que no sean summary */}
              {currentStep !== 'summary' && (
                <Button
                  variant="outline"
                  onClick={onSave}
                  disabled={isCreatingReport || isUpdatingReport}
                  size="sm"
                  className="text-xs px-3 h-8"
                >
                  <Save className="h-3 w-3 mr-1" />
                  {isCreatingReport || isUpdatingReport ? 'Guardando...' : 'Guardar'}
                </Button>
              )}
              
              {/* Botón de finalizar - solo visible en la pantalla summary */}
              {currentStep === 'summary' && (
                <Button
                  onClick={handleComplete}
                  disabled={!canComplete || isCreatingReport || isUpdatingReport}
                  className={`text-xs px-4 h-8 ${canComplete ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  size="sm"
                  title={
                    !isTaskFromToday ? "Solo puedes completar tareas de hoy" :
                    !requiredValidation.isValid ? "Faltan tareas o fotos obligatorias" :
                    "Finalizar tarea"
                  }
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Finalizar Tarea
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
              className="text-xs px-3 h-8"
            >
              <Save className="h-3 w-3 mr-1" />
              {isCreatingReport || isUpdatingReport ? 'Guardando...' : 'Guardar'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
