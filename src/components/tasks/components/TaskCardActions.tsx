
import React from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Trash, UserPlus, Users } from 'lucide-react';
import { Task } from '@/types/calendar';
import { TaskReportButton } from './TaskReportButton';

interface TaskCardActionsProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onEditTask?: (task: Task) => void;
  onCreateReport?: (task: Task) => void;
  onOpenReport: () => void;
  onAssignCleaner?: (task: Task) => void;
  onAssignMultipleCleaners?: (task: Task) => void;
  showActions?: boolean;
}

export const TaskCardActions: React.FC<TaskCardActionsProps> = ({
  task,
  onEdit,
  onDelete,
  onEditTask,
  onCreateReport,
  onOpenReport,
  onAssignCleaner,
  onAssignMultipleCleaners,
  showActions = true,
}) => {
  const handleEdit = () => {
    console.log('🔍 TaskCardActions handleEdit clicked');
    console.log('🔍 onEdit available:', !!onEdit);
    console.log('🔍 onEditTask available:', !!onEditTask);
    
    // Use onEdit first (from useTaskActions), then fall back to onEditTask
    if (onEdit) {
      console.log('🔍 Calling onEdit');
      onEdit(task);
    } else if (onEditTask) {
      console.log('🔍 Calling onEditTask');
      onEditTask(task);
    } else {
      console.log('🔍 No edit handlers available');
    }
  };

  const handleDelete = () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
      if (onDelete) onDelete(task.id);
    }
  };

  const handleAssignCleaner = () => {
    if (onAssignCleaner) onAssignCleaner(task);
  };

  const handleAssignMultipleCleaners = () => {
    if (onAssignMultipleCleaners) onAssignMultipleCleaners(task);
  };

  if (!showActions) {
    return null;
  }

  return (
    <div className="pt-4 mt-4 border-t border-gray-100 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handleEdit}
          className="flex items-center gap-2 px-3 py-1.5 h-8 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all duration-200 rounded-md font-medium text-sm border-gray-300"
        >
          <Edit className="h-3.5 w-3.5" />
          Editar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          className="flex items-center gap-2 px-3 py-1.5 h-8 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all duration-200 rounded-md font-medium text-sm border-gray-300"
        >
          <Trash className="h-3.5 w-3.5" />
          Eliminar
        </Button>
        {onAssignCleaner && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAssignCleaner}
            className="flex items-center gap-2 px-3 py-1.5 h-8 bg-white hover:bg-green-50 hover:text-green-600 hover:border-green-300 transition-all duration-200 rounded-md font-medium text-sm border-gray-300"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Asignar
          </Button>
        )}
        {onAssignMultipleCleaners && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAssignMultipleCleaners}
            className="flex items-center gap-2 px-3 py-1.5 h-8 bg-white hover:bg-purple-50 hover:text-purple-600 hover:border-purple-300 transition-all duration-200 rounded-md font-medium text-sm border-gray-300"
          >
            <Users className="h-3.5 w-3.5" />
            Múltiples
          </Button>
        )}
      </div>

      <TaskReportButton
        task={task}
        onOpenReport={onCreateReport || onOpenReport}
        className="flex items-center gap-2 px-3 py-1.5 h-8 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all duration-200 border border-gray-200 hover:border-gray-300"
      />
    </div>
  );
};
