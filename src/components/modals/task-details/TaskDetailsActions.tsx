import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, UserX, UserPlus, Users } from "lucide-react";
import { Task } from "@/types/calendar";
import { useAuth } from "@/hooks/useAuth";
import { useTaskReport } from "@/hooks/useTaskReports";
import { useCleaners } from "@/hooks/useCleaners";

interface TaskDetailsActionsProps {
  task: Task;
  onDelete?: () => void;
  onUnassign?: () => void;
  onAssign?: (cleanerId: string, cleanerName: string) => void;
  onAssignMultiple?: () => void;
  onOpenReport: () => void;
}

export const TaskDetailsActions = ({
  task,
  onDelete,
  onUnassign,
  onAssign,
  onAssignMultiple,
  onOpenReport,
}: TaskDetailsActionsProps) => {
  const { userRole } = useAuth();
  const { data: existingReport } = useTaskReport(task.id);
  const { cleaners } = useCleaners();
  const canManageTasks = userRole === 'admin' || userRole === 'manager';
  const canCreateReport = userRole === 'cleaner' && task?.cleanerId;
  const canViewReport = ['admin', 'manager', 'supervisor'].includes(userRole || '') || (userRole === 'cleaner' && !!task?.cleanerId);

  const getReportButtonText = () => {
    if (!existingReport) return "Crear Reporte";
    switch (existingReport.overall_status) {
      case 'pending':
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

  const getReportButtonVariant = () => {
    if (!existingReport) return "default";
    switch (existingReport.overall_status) {
      case 'completed':
        return "outline";
      case 'needs_review':
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 w-full">
      {/* Eliminar */}
      {canManageTasks && onDelete && (
        <Button variant="destructive" size="sm" onClick={onDelete} className="flex items-center gap-1 text-xs px-2 h-8">
          <Trash2 className="h-3 w-3" />
          <span className="hidden xs:inline">Eliminar</span>
        </Button>
      )}

      {/* Asignar individual */}
      {onAssign && canManageTasks && (
        <Select onValueChange={(value) => {
          const [cleanerId, cleanerName] = value.split('|');
          onAssign(cleanerId, cleanerName);
        }}>
          <SelectTrigger className="flex items-center gap-1 h-8 px-2 w-auto min-w-20">
            <UserPlus className="h-3 w-3" />
            <span className="hidden xs:inline">Asignar</span>
          </SelectTrigger>
          <SelectContent className="z-50">
            {cleaners.map((cleaner) => (
              <SelectItem key={cleaner.id} value={`${cleaner.id}|${cleaner.name}`}>
                {cleaner.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Asignar múltiples */}
      {onAssignMultiple && canManageTasks && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAssignMultiple}
          className="flex items-center gap-1 text-xs px-2 h-8"
        >
          <Users className="h-3 w-3" />
          <span className="hidden xs:inline">Múltiples</span>
        </Button>
      )}

      {/* Desasignar */}
      {task.cleaner && onUnassign && canManageTasks && (
        <Button variant="outline" size="sm" onClick={onUnassign} className="flex items-center gap-1 text-xs px-2 h-8">
          <UserX className="h-3 w-3" />
          <span className="hidden xs:inline">Desasignar</span>
        </Button>
      )}

      {/* Reporte */}
      {(canCreateReport || canViewReport) && (
        <Button
          onClick={onOpenReport}
          variant={getReportButtonVariant() as "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"}
          size="sm"
          className="flex items-center gap-1 text-xs px-2 h-8 ml-auto"
        >
          <span className="truncate">{getReportButtonText()}</span>
        </Button>
      )}
    </div>
  );
};
