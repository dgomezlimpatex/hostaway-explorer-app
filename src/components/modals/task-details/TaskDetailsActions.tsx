import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit3, Save, X, UserX, UserPlus, Users } from "lucide-react";
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
  onAssignMultiple?: () => void;
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
  onAssignMultiple,
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
  return <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Botón de Eliminar - Solo para managers/supervisors/admin */}
        {userRole !== 'cleaner' && (
          <Button variant="destructive" size="sm" onClick={onDelete} className="flex items-center gap-1 text-xs px-2 h-8">
            <Trash2 className="h-3 w-3" />
            <span className="hidden xs:inline">Eliminar</span>
          </Button>
        )}
        
        {/* Botón de Asignar Individual - Solo para managers/supervisors/admin */}
        {onAssign && userRole !== 'cleaner' && (
          <Select onValueChange={(value) => {
            const [cleanerId, cleanerName] = value.split('|');
            onAssign(cleanerId, cleanerName);
          }}>
            <SelectTrigger className="flex items-center gap-1 h-8 px-2 w-auto min-w-20">
              <UserPlus className="h-3 w-3" />
              <span className="hidden xs:inline">Asignar</span>
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 z-50">
              {cleaners.map((cleaner) => (
                <SelectItem key={cleaner.id} value={`${cleaner.id}|${cleaner.name}`}>
                  {cleaner.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Botón de Asignar Múltiples - Solo para managers/supervisors/admin */}
        {onAssignMultiple && userRole !== 'cleaner' && (
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
        
        {/* Botón de Desasignar - Solo para managers/supervisors/admin */}
        {task.cleaner && onUnassign && userRole !== 'cleaner' && (
          <Button variant="outline" size="sm" onClick={onUnassign} className="flex items-center gap-1 text-xs px-2 h-8">
            <UserX className="h-3 w-3" />
            <span className="hidden xs:inline">Desasignar</span>
          </Button>
        )}

        {/* Botón de Reporte */}
        {(canCreateReport || canViewReport) && (
          <Button 
            onClick={onOpenReport} 
            variant={getReportButtonVariant() as "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"}
            size="sm"
            className="flex items-center gap-1 text-xs px-2 h-8"
          >
            <span className="truncate">{getReportButtonText()}</span>
          </Button>
        )}
      </div>
      
      {/* Botones de Editar - Solo para managers/supervisors/admin */}
      {userRole !== 'cleaner' && (
        <div className="flex items-center gap-2 justify-end">
          {isEditing ? <>
              <Button variant="outline" onClick={onCancel} className="flex items-center gap-1 text-xs px-2 h-8">
                <X className="h-3 w-3" />
                <span className="hidden xs:inline">Cancelar</span>
              </Button>
              <Button onClick={onSave} className="flex items-center gap-1 text-xs px-2 h-8">
                <Save className="h-3 w-3" />
                <span className="hidden xs:inline">Guardar</span>
              </Button>
            </> : <Button onClick={onEdit} className="flex items-center justify-center gap-2 text-sm px-4 h-10 min-w-[100px]">
              <Edit3 className="h-4 w-4" />
              <span>Editar</span>
            </Button>}
        </div>
      )}
    </div>;
};