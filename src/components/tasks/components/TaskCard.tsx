
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, User, Edit, Trash2, Calendar, FileText } from 'lucide-react';
import { Task } from '@/types/calendar';
import { TaskReportButton } from './TaskReportButton';
import { TaskReportModal } from '@/components/modals/TaskReportModal';

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onUnassign?: (taskId: string) => void;
  onView?: (task: Task) => void;
  onShowHistory?: (task: Task) => void;
  onCreateReport?: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  showActions?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onEdit,
  onDelete,
  onUnassign,
  onView,
  onShowHistory,
  onCreateReport,
  onEditTask,
  showActions = true,
}) => {
  const [showReportModal, setShowReportModal] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'in-progress':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'Completado';
      case 'in-progress':
        return 'En Progreso';
      case 'pending':
        return 'Pendiente';
      default:
        return status;
    }
  };

  const handleOpenReport = () => {
    setShowReportModal(true);
  };

  const handleEdit = () => {
    if (onEdit) onEdit(task);
    if (onEditTask) onEditTask(task);
  };

  const handleDelete = () => {
    if (onDelete) onDelete(task.id);
  };

  return (
    <>
      <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-white rounded-xl overflow-hidden">
        <CardContent className="p-6">
          {/* Header Section */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold text-lg text-gray-900 truncate">
                  {task.property}
                </h3>
                <Badge className={`${getStatusColor(task.status)} font-medium px-3 py-1 rounded-full text-xs`}>
                  {getStatusText(task.status)}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="truncate">{task.address}</span>
              </div>
            </div>

            {/* Action Buttons - Always visible with modern styling */}
            {showActions && (
              <div className="flex items-center gap-2 ml-4">
                {(onEdit || onEditTask) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEdit}
                    className="h-8 w-8 p-0 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Time and Date Section */}
          <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                {task.startTime} - {task.endTime}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                {task.date}
              </span>
            </div>
          </div>

          {/* Cleaner Section */}
          {task.cleaner && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 rounded-lg">
              <User className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-700">{task.cleaner}</span>
            </div>
          )}

          {/* Footer Section */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-medium px-2 py-1 rounded-md">
                {task.type}
              </Badge>
              {task.supervisor && (
                <Badge variant="secondary" className="text-xs font-medium px-2 py-1 rounded-md bg-purple-50 text-purple-700">
                  Supervisor: {task.supervisor}
                </Badge>
              )}
            </div>

            <TaskReportButton
              task={task}
              onOpenReport={onCreateReport || handleOpenReport}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            />
          </div>
        </CardContent>
      </Card>

      <TaskReportModal
        task={task}
        open={showReportModal}
        onOpenChange={setShowReportModal}
      />
    </>
  );
};
