
import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Camera } from 'lucide-react';
import { useTaskReport } from '@/hooks/useTaskReports';
import { Task } from '@/types/calendar';
import { useAuth } from '@/hooks/useAuth';

interface CreateReportButtonProps {
  task: Task;
  onCreateReport: (task: Task) => void;
}

export const CreateReportButton: React.FC<CreateReportButtonProps> = ({
  task,
  onCreateReport,
}) => {
  const { userRole } = useAuth();
  const { data: existingReport, isLoading } = useTaskReport(task.id);

  // Solo mostrar para limpiadoras y si la tarea está asignada
  if (userRole !== 'cleaner' || !task.cleaner_id) {
    return null;
  }

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <FileText className="h-4 w-4 mr-2" />
        Cargando...
      </Button>
    );
  }

  const hasReport = !!existingReport;
  const reportStatus = existingReport?.overall_status;

  const getButtonText = () => {
    if (!hasReport) return "Crear Reporte";
    switch (reportStatus) {
      case 'pending':
        return "Continuar Reporte";
      case 'in_progress':
        return "Continuar Reporte";
      case 'completed':
        return "Ver Reporte";
      case 'needs_review':
        return "Revisar Reporte";
      default:
        return "Ver Reporte";
    }
  };

  const getButtonVariant = () => {
    if (!hasReport) return "default";
    switch (reportStatus) {
      case 'completed':
        return "outline";
      case 'needs_review':
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <Button
      variant={getButtonVariant()}
      size="sm"
      onClick={() => onCreateReport(task)}
      className="ml-2"
    >
      {!hasReport ? (
        <Camera className="h-4 w-4 mr-2" />
      ) : (
        <FileText className="h-4 w-4 mr-2" />
      )}
      {getButtonText()}
    </Button>
  );
};
