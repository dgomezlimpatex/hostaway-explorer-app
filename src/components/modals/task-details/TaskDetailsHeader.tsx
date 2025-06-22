
import { Badge } from "@/components/ui/badge";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Task } from "@/types/calendar";
import { useTaskReport } from "@/hooks/useTaskReports";

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
        <DialogTitle>Detalles de la Tarea</DialogTitle>
        <DialogDescription>
          {isEditing ? 'Edita los detalles de la tarea' : 'Información completa de la tarea'}
        </DialogDescription>
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
