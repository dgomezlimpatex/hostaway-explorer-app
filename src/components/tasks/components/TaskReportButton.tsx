
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Camera, Clock, CheckCircle, AlertTriangle, Users } from 'lucide-react';
import { useTaskReport } from '@/hooks/useTaskReports';
import { useGroupedTaskReport } from '@/hooks/useGroupedTaskReports';
import { multipleTaskAssignmentService } from '@/services/storage/multipleTaskAssignmentService';
import { Task } from '@/types/calendar';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

interface TaskReportButtonProps {
  task: Task;
  onOpenReport: (task: Task) => void;
  onOpenGroupedReport?: (task: Task) => void;
  className?: string;
}

export const TaskReportButton: React.FC<TaskReportButtonProps> = ({
  task,
  onOpenReport,
  onOpenGroupedReport,
  className = "",
}) => {
  const { userRole } = useAuth();
  const { data: existingReport, isLoading } = useTaskReport(task.id);
  
  // Check for multiple assignments
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['taskAssignments', task.id],
    queryFn: () => multipleTaskAssignmentService.getTaskAssignments(task.id),
  });
  
  const { data: groupedReport } = useGroupedTaskReport(task.id);
  
  const hasMultipleAssignments = assignments && assignments.length > 1;
  const isMultipleReportsScenario = hasMultipleAssignments && groupedReport && groupedReport.total_reports > 0;

  // Solo mostrar para roles autorizados
  const canAccess = ['admin', 'manager', 'supervisor'].includes(userRole || '') || 
                   (userRole === 'cleaner' && task.cleanerId);

  if (!canAccess) {
    return null;
  }

  if (isLoading || assignmentsLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className={className}>
        <Clock className="h-4 w-4 mr-2" />
        Cargando...
      </Button>
    );
  }

  const hasReport = !!existingReport;
  const reportStatus = existingReport?.overall_status;

  // Check if task is from today - stricter validation
  const today = new Date();
  const taskDate = new Date(task.date + 'T00:00:00');
  const isTaskFromToday = taskDate.toDateString() === today.toDateString();

  const getButtonConfig = () => {
    // If this is a multiple assignments scenario, show grouped view for supervisors/admins
    if (isMultipleReportsScenario && ['admin', 'manager', 'supervisor'].includes(userRole || '')) {
      return {
        text: `Ver Reportes (${groupedReport.total_reports})`,
        variant: "outline",
        icon: Users,
        disabled: false,
        isGrouped: true
      };
    }
    
    if (!hasReport) {
      return {
        text: userRole === 'cleaner' ? (isTaskFromToday ? "Crear Reporte" : "Tarea Futura") : "Sin Reporte",
        variant: userRole === 'cleaner' ? (isTaskFromToday ? "default" : "ghost") : "ghost",
        icon: Camera,
        disabled: userRole !== 'cleaner' || !isTaskFromToday,
        isGrouped: false
      };
    }

    switch (reportStatus) {
      case 'pending':
        return {
          text: "Pendiente",
          variant: "secondary",
          icon: Clock,
          disabled: false,
          isGrouped: false
        };
      case 'in_progress':
        return {
          text: "En Progreso",
          variant: "default",
          icon: FileText,
          disabled: false,
          isGrouped: false
        };
      case 'completed':
        return {
          text: "Completado",
          variant: "outline",
          icon: CheckCircle,
          disabled: false,
          isGrouped: false
        };
      case 'needs_review':
        return {
          text: "Revisar",
          variant: "destructive",
          icon: AlertTriangle,
          disabled: false,
          isGrouped: false
        };
      default:
        return {
          text: "Ver Reporte",
          variant: "outline",
          icon: FileText,
          disabled: false,
          isGrouped: false
        };
    }
  };

  const config = getButtonConfig();
  const Icon = config.icon;

  const handleClick = () => {
    if (config.isGrouped && onOpenGroupedReport) {
      onOpenGroupedReport(task);
    } else {
      onOpenReport(task);
    }
  };

  return (
    <Button
      variant={config.variant as "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"}
      size="sm"
      onClick={handleClick}
      disabled={config.disabled}
      className={`${className} flex items-center gap-2`}
    >
      <Icon className="h-4 w-4" />
      {config.text}
    </Button>
  );
};
