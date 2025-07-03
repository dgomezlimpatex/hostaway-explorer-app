
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
  canComplete: boolean;
  isCreatingReport: boolean;
  isUpdatingReport: boolean;
  completionPercentage: number;
  requiredValidation: RequiredValidation;
  isTaskFromToday: boolean;
  isTaskCompleted?: boolean;
}

export const TaskReportFooter: React.FC<TaskReportFooterProps> = ({
  onCancel,
  onSave,
  onComplete,
  canComplete,
  isCreatingReport,
  isUpdatingReport,
  completionPercentage,
  requiredValidation,
  isTaskFromToday,
  isTaskCompleted = false
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
    <div className="border-t pt-4 flex items-center justify-between">
      <Button variant="outline" onClick={onCancel}>
        {isTaskCompleted ? "Cerrar" : "Cancelar"}
      </Button>
      
      <div className="flex items-center space-x-2">
        {!isTaskCompleted && (
          <Button
            variant="outline"
            onClick={onSave}
            disabled={isCreatingReport || isUpdatingReport}
          >
            <Save className="h-4 w-4 mr-2" />
            {isCreatingReport || isUpdatingReport ? 'Guardando...' : 'Guardar'}
          </Button>
        )}
        
        <Button
          onClick={isTaskCompleted ? onSave : handleComplete}
          disabled={!isTaskCompleted && (!canComplete || isCreatingReport || isUpdatingReport)}
          className={!isTaskCompleted && canComplete ? 'bg-green-600 hover:bg-green-700' : ''}
          title={
            isTaskCompleted ? "Guardar cambios en incidencias y notas" :
            !isTaskFromToday ? "Solo puedes completar tareas de hoy" :
            !requiredValidation.isValid ? "Faltan tareas o fotos obligatorias" :
            "Completar reporte"
          }
        >
          {isTaskCompleted ? (
            <>
              <Save className="h-4 w-4 mr-2" />
              Guardar Cambios
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Completar Reporte
            </>
          )}
        </Button>
        
        {!canComplete && !isTaskCompleted && (
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
