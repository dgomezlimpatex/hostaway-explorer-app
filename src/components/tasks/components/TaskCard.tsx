
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
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-100';
      case 'in-progress':
        return 'bg-blue-50 text-blue-700 border-blue-200 shadow-blue-100';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200 shadow-amber-100';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 shadow-gray-100';
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
    if (window.confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
      if (onDelete) onDelete(task.id);
    }
  };

  return (
    <>
      <Card className="group relative overflow-hidden bg-white hover:shadow-xl transition-all duration-300 border-0 shadow-md hover:shadow-2xl hover:-translate-y-1">
        {/* Status indicator line */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${
          task.status === 'completed' ? 'bg-emerald-500' :
          task.status === 'in-progress' ? 'bg-blue-500' :
          'bg-amber-500'
        }`} />

        <CardContent className="p-6 space-y-4">
          {/* Header Section */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xl text-gray-900 leading-tight">
                  {task.property}
                </h3>
                <Badge className={`${getStatusColor(task.status)} font-semibold px-3 py-1.5 rounded-full text-xs border shadow-sm`}>
                  {getStatusText(task.status)}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-medium truncate">{task.address}</span>
              </div>
            </div>
          </div>

          {/* Time and Date Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <Clock className="h-4 w-4 text-gray-500" />
              <div className="text-sm">
                <div className="font-semibold text-gray-900">
                  {task.startTime} - {task.endTime}
                </div>
                <div className="text-gray-500 text-xs">Horario</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <Calendar className="h-4 w-4 text-gray-500" />
              <div className="text-sm">
                <div className="font-semibold text-gray-900">{task.date}</div>
                <div className="text-gray-500 text-xs">Fecha</div>
              </div>
            </div>
          </div>

          {/* Cleaner Section */}
          {task.cleaner && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="font-semibold text-blue-900">{task.cleaner}</div>
                <div className="text-blue-600 text-xs">Limpiador asignado</div>
              </div>
            </div>
          )}

          {/* Service Type and Supervisor */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="px-3 py-1.5 font-medium bg-white border-gray-200 text-gray-700">
                {task.type}
              </Badge>
              {task.supervisor && (
                <Badge variant="secondary" className="px-3 py-1.5 font-medium bg-purple-50 text-purple-700 border-purple-200">
                  Supervisor: {task.supervisor}
                </Badge>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {showActions && (
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
                onOpenReport={onCreateReport || handleOpenReport}
                className="flex items-center gap-2 px-4 py-2 h-9 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200 border border-gray-200 hover:border-gray-300"
              />
            </div>
          )}
        </CardContent>

        {/* Hover effect overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-gray-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </Card>

      <TaskReportModal
        task={task}
        open={showReportModal}
        onOpenChange={setShowReportModal}
      />
    </>
  );
};
