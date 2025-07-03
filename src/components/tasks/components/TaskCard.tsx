
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Task } from '@/types/calendar';
import { TaskReportModal } from '@/components/modals/TaskReportModal';
import { TaskCardHeader } from './TaskCardHeader';
import { TaskCardTimeInfo } from './TaskCardTimeInfo';
import { TaskCardCleanerInfo } from './TaskCardCleanerInfo';
import { TaskCardServiceInfo } from './TaskCardServiceInfo';
import { TaskCardActions } from './TaskCardActions';
import { CleanerTaskCard } from '@/components/calendar/cleaner/CleanerTaskCard';
import { useDeviceType } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';

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
  const { isMobile, isTablet } = useDeviceType();
  const { userRole } = useAuth();
  const [showReportModal, setShowReportModal] = useState(false);

  // Use CleanerTaskCard for mobile cleaners
  if (isMobile && userRole === 'cleaner') {
    const handleTaskClick = () => {
      if (onCreateReport) {
        onCreateReport(task);
      }
    };

    return <CleanerTaskCard task={task} onClick={handleTaskClick} />;
  }

  const handleOpenReport = () => {
    setShowReportModal(true);
  };

  // Default handlers to ensure buttons work
  const handleEdit = onEdit || onEditTask || ((task: Task) => {
    console.log('Edit task:', task.id);
    alert(`Editar tarea: ${task.property}`);
  });

  const handleDelete = onDelete || ((taskId: string) => {
    console.log('Delete task:', taskId);
    alert(`Eliminar tarea: ${taskId}`);
  });

  // Responsive card padding and spacing
  const getCardClasses = () => {
    if (isMobile) {
      return "group relative overflow-hidden bg-white hover:shadow-lg transition-all duration-300 border border-gray-200 shadow-sm";
    }
    return "group relative overflow-hidden bg-white hover:shadow-xl transition-all duration-300 border border-gray-200 shadow-sm hover:shadow-2xl hover:-translate-y-1";
  };

  const getCardPadding = () => {
    return isMobile ? "p-4 space-y-3" : "p-6 space-y-4";
  };

  console.log('TaskCard rendering for task:', task.id, { 
    hasOnEdit: !!onEdit, 
    hasOnDelete: !!onDelete, 
    hasOnEditTask: !!onEditTask,
    showActions,
    isMobile,
    isTablet
  });

  return (
    <>
      <Card className={getCardClasses()}>
        {/* Status indicator line */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${
          task.status === 'completed' ? 'bg-emerald-500' :
          task.status === 'in-progress' ? 'bg-blue-500' :
          'bg-amber-500'
        }`} />

        <CardContent className={getCardPadding()}>
          <TaskCardHeader
            property={task.property}
            address={task.address}
            status={task.status}
          />

          <TaskCardTimeInfo
            startTime={task.startTime}
            endTime={task.endTime}
            date={task.date}
          />

          <TaskCardCleanerInfo cleaner={task.cleaner} />

          <TaskCardServiceInfo
            type={task.type}
            supervisor={task.supervisor}
          />

          {/* Always show actions - this ensures edit and delete buttons are visible */}
          <TaskCardActions
            task={task}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onEditTask={onEditTask}
            onCreateReport={onCreateReport}
            onOpenReport={handleOpenReport}
            showActions={true}
          />
        </CardContent>

        {/* Hover effect overlay - Only on non-mobile */}
        {!isMobile && (
          <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-gray-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        )}
      </Card>

      <TaskReportModal
        task={task}
        open={showReportModal}
        onOpenChange={setShowReportModal}
      />
    </>
  );
};
