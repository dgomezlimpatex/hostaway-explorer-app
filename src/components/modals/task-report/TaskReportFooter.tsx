
import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TaskReportFooterProps {
  onCancel: () => void;
  onSave: () => void;
  onComplete: () => void;
  canComplete: boolean;
  isCreatingReport: boolean;
  isUpdatingReport: boolean;
  completionPercentage: number;
}

export const TaskReportFooter: React.FC<TaskReportFooterProps> = ({
  onCancel,
  onSave,
  onComplete,
  canComplete,
  isCreatingReport,
  isUpdatingReport,
  completionPercentage
}) => {
  const { toast } = useToast();

  const handleComplete = () => {
    if (completionPercentage < 80) {
      toast({
        title: "Reporte incompleto",
        description: "Completa al menos el 80% del checklist para finalizar el reporte.",
        variant: "destructive",
      });
      return;
    }
    onComplete();
  };

  return (
    <div className="border-t pt-4 flex items-center justify-between">
      <Button variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          onClick={onSave}
          disabled={isCreatingReport || isUpdatingReport}
        >
          <Save className="h-4 w-4 mr-2" />
          {isCreatingReport || isUpdatingReport ? 'Guardando...' : 'Guardar'}
        </Button>
        
        <Button
          onClick={handleComplete}
          disabled={!canComplete || isCreatingReport || isUpdatingReport}
          className={canComplete ? 'bg-green-600 hover:bg-green-700' : ''}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Completar Reporte
        </Button>
      </div>
    </div>
  );
};
