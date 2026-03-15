
import { Badge } from "@/components/ui/badge";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Task } from "@/types/calendar";
import { useTaskReport } from "@/hooks/useTaskReports";
import { Edit3, Eye } from "lucide-react";

interface TaskDetailsHeaderProps {
  task: Task;
  isEditing: boolean;
}

export const TaskDetailsHeader = ({ task, isEditing }: TaskDetailsHeaderProps) => {
  const { data: existingReport } = useTaskReport(task.id);

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'destructive',
      'in-progress': 'default',
      completed: 'secondary'
    } as const;
    
    const texts = {
      pending: 'Pendiente',
      'in-progress': 'En Progreso',
      completed: 'Completado'
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {texts[status as keyof typeof texts] || status}
      </Badge>
    );
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <DialogTitle className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Edit3 className="h-5 w-5 text-blue-600" />
              Editando Tarea
            </>
          ) : (
            <>
              <Eye className="h-5 w-5 text-gray-600" />
              Detalles de la Tarea
            </>
          )}
        </DialogTitle>
        <div className="flex items-center gap-2 mt-1">
          <DialogDescription className="m-0">
            {isEditing ? 'Edita los detalles de la tarea' : 'Información completa de la tarea'}
          </DialogDescription>
          {isEditing && (task as any)?.isRecurringInstance ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
              ✏️ Editando solo esta ocurrencia
            </Badge>
          ) : isEditing ? (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
              Modo Edición
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!isEditing && getStatusBadge(task.status)}
        {task.cleaner && (
          <Badge variant="outline">
            👤 {task.cleaner}
          </Badge>
        )}
        {existingReport && (
          <Badge variant={existingReport.overall_status === 'completed' ? 'default' : 'secondary'}>
            📋 {existingReport.overall_status === 'completed' ? 'Reporte Completo' : 'Reporte Pendiente'}
          </Badge>
        )}
      </div>
    </div>
  );
};
