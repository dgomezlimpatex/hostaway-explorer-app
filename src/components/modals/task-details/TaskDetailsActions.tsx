import { Button } from "@/components/ui/button";
import { Trash2, Edit3, Save, X, UserX, FileText, Camera } from "lucide-react";
import { Task } from "@/types/calendar";
import { useAuth } from "@/hooks/useAuth";
import { useTaskReport } from "@/hooks/useTaskReports";
interface TaskDetailsActionsProps {
  task: Task;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onUnassign?: () => void;
  onOpenReport: () => void;
}
export const TaskDetailsActions = ({
  task,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onUnassign,
  onOpenReport
}: TaskDetailsActionsProps) => {
  const {
    userRole
  } = useAuth();
  const {
    data: existingReport
  } = useTaskReport(task.id);
  const canCreateReport = userRole === 'cleaner' && task?.cleanerId;
  const canViewReport = ['admin', 'manager', 'supervisor'].includes(userRole || '') || userRole === 'cleaner' && task?.cleanerId;
  const getReportButtonText = () => {
    if (!existingReport) return "Crear Reporte";
    switch (existingReport.overall_status) {
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
  return <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <Button variant="destructive" size="sm" onClick={onDelete} className="flex items-center gap-1 px-2 py-1 text-xs">
          <Trash2 className="h-3 w-3" />
          Eliminar
        </Button>
        
        {task.cleaner && onUnassign && <Button variant="outline" size="sm" onClick={onUnassign} className="flex items-center gap-2">
            <UserX className="h-4 w-4" />
            Desasignar
          </Button>}

        {/* Botón de Reporte */}
        {canCreateReport || canViewReport}
      </div>
      
      <div className="flex items-center gap-2">
        {isEditing ? <>
            <Button variant="outline" onClick={onCancel} className="flex items-center gap-2">
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={onSave} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Guardar
            </Button>
          </> : <Button onClick={onEdit} className="flex items-center gap-2 px-[8px] py-0 my-0 mx-0">
            <Edit3 className="h-4 w-4" />
            Editar
          </Button>}
      </div>
    </div>;
};