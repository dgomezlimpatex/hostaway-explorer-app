
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Camera, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useTaskReport } from '@/hooks/useTaskReports';
import { Task } from '@/types/calendar';
import { useAuth } from '@/hooks/useAuth';

interface TaskReportButtonProps {
  task: Task;
  onOpenReport: (task: Task) => void;
  className?: string;
}

export const TaskReportButton: React.FC<TaskReportButtonProps> = ({
  task,
  onOpenReport,
  className = "",
}) => {
  const { userRole } = useAuth();
  const { data: existingReport, isLoading } = useTaskReport(task.id);

  // Solo mostrar para roles autorizados
  const canAccess = ['admin', 'manager', 'supervisor'].includes(userRole || '') || 
                   (userRole === 'cleaner' && task.cleanerId);

  if (!canAccess) {
    return null;
  }

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className={className}>
        <Clock className="h-4 w-4 mr-2" />
        Cargando...
      </Button>
    );
  }

  const hasReport = !!existingReport;
  const reportStatus = existingReport?.overall_status;

  // Check if task is from today
  const isTaskFromToday = task.date === new Date().toISOString().split('T')[0];

  const getButtonConfig = () => {
    if (!hasReport) {
      return {
        text: userRole === 'cleaner' ? (isTaskFromToday ? "Crear Reporte" : "Tarea Futura") : "Sin Reporte",
        variant: userRole === 'cleaner' ? (isTaskFromToday ? "default" : "ghost") : "ghost",
        icon: Camera,
        disabled: userRole !== 'cleaner' || !isTaskFromToday
      };
    }

    switch (reportStatus) {
      case 'pending':
        return {
          text: "Pendiente",
          variant: "secondary",
          icon: Clock,
          disabled: false
        };
      case 'in_progress':
        return {
          text: "En Progreso",
          variant: "default",
          icon: FileText,
          disabled: false
        };
      case 'completed':
        return {
          text: "Completado",
          variant: "outline",
          icon: CheckCircle,
          disabled: false
        };
      case 'needs_review':
        return {
          text: "Revisar",
          variant: "destructive",
          icon: AlertTriangle,
          disabled: false
        };
      default:
        return {
          text: "Ver Reporte",
          variant: "outline",
          icon: FileText,
          disabled: false
        };
    }
  };

  const config = getButtonConfig();
  const Icon = config.icon;

  return (
    <Button
      variant={config.variant as "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"}
      size="sm"
      onClick={() => onOpenReport(task)}
      disabled={config.disabled}
      className={`${className} flex items-center gap-2`}
    >
      <Icon className="h-4 w-4" />
      {config.text}
    </Button>
  );
};
