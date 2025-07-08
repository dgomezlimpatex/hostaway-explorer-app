import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit3, Save, X, UserX, UserPlus } from "lucide-react";
import { Task } from "@/types/calendar";
import { useAuth } from "@/hooks/useAuth";
import { useTaskReport } from "@/hooks/useTaskReports";
import { useCleaners } from "@/hooks/useCleaners";
interface TaskDetailsActionsProps {
  task: Task;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onUnassign?: () => void;
  onAssign?: (cleanerId: string, cleanerName: string) => void;
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
  onAssign,
  onOpenReport
}: TaskDetailsActionsProps) => {
  const { userRole } = useAuth();
  const { data: existingReport } = useTaskReport(task.id);
  const { cleaners } = useCleaners();
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
        <Button variant="destructive" size="sm" onClick={onDelete} className="flex items-center gap-1 py-1 text-xs px-[9px] mx-[5px]">
          <Trash2 className="h-3 w-3" />
          Eliminar
        </Button>
        
        {/* Botón de Asignar */}
        {onAssign && (
          <Select onValueChange={(value) => {
            const [cleanerId, cleanerName] = value.split('|');
            onAssign(cleanerId, cleanerName);
          }}>
            <SelectTrigger className="flex items-center gap-2 h-9 px-3">
              <UserPlus className="h-4 w-4" />
              <span>Asignar</span>
            </SelectTrigger>
            <SelectContent>
              {cleaners.map((cleaner) => (
                <SelectItem key={cleaner.id} value={`${cleaner.id}|${cleaner.name}`}>
                  {cleaner.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {task.cleaner && onUnassign && (
          <Button variant="outline" size="sm" onClick={onUnassign} className="flex items-center gap-2">
            <UserX className="h-4 w-4" />
            Desasignar
          </Button>
        )}

        {/* Botón de Reporte */}
        {canCreateReport || canViewReport}
      </div>
      
      <div className="flex items-center gap-2">
        {isEditing ? <>
            <Button variant="outline" onClick={onCancel} className="flex items-center gap-2 mx-[5px] px-0">
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={onSave} className="flex items-center gap-2 px-[12px]">
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