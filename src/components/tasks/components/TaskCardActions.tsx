
import React from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { Task } from '@/types/calendar';
import { TaskReportButton } from './TaskReportButton';

interface TaskCardActionsProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onEditTask?: (task: Task) => void;
  onCreateReport?: (task: Task) => void;
  onOpenReport: () => void;
  showActions?: boolean;
}

export const TaskCardActions: React.FC<TaskCardActionsProps> = ({
  task,
  onEdit,
  onDelete,
  onEditTask,
  onCreateReport,
  onOpenReport,
  showActions = true,
}) => {
  const handleEdit = () => {
    if (onEdit) onEdit(task);
    if (onEditTask) onEditTask(task);
  };

  const handleDelete = () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
      if (onDelete) onDelete(task.id);
    }
  };

  if (!showActions) return null;

  return (
    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleEdit}
          className="flex items-center gap-2 px-4 py-2 h-9 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all duration-200 rounded-lg font-medium"
        >
          <Edit className="h-4 w-4" />
          Editar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          className="flex items-center gap-2 px-4 py-2 h-9 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all duration-200 rounded-lg font-medium"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar
        </Button>
      </div>

      <TaskReportButton
        task={task}
        onOpenReport={onCreateReport || onOpenReport}
        className="flex items-center gap-2 px-4 py-2 h-9 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200 border border-gray-200 hover:border-gray-300"
      />
    </div>
  );
};
