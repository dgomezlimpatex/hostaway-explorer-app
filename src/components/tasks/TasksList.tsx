
import React from 'react';
import { Task } from "@/types/calendar";
import { TaskDetailsModal } from '@/components/modals/TaskDetailsModal';
import { AssignCleanerModal } from '@/components/modals/AssignCleanerModal';
import { TaskPreviewModal } from '@/components/modals/TaskPreviewModal';
import { TaskCard } from './components/TaskCard';
import { useTaskActions } from './hooks/useTaskActions';
import { filterTasks } from './utils/taskFilters';
import { useDeviceType } from '@/hooks/use-mobile';

interface TasksListProps {
  tasks: Task[];
  filters: {
    status: string;
    cleaner: string;
    dateRange: string;
    cliente: string;
    propiedad: string;
  };
  isLoading: boolean;
  onShowHistory?: (task: Task) => void;
  onCreateReport?: (task: Task) => void;
  onRefetch?: () => void;
}

export const TasksList = React.memo(({ 
  tasks, 
  filters, 
  isLoading, 
  onShowHistory,
  onCreateReport,
  onRefetch 
}: TasksListProps) => {
  const { isMobile, isTablet } = useDeviceType();
  const {
    selectedTask,
    isModalOpen,
    setIsModalOpen,
    openInEditMode,
    handleModalClose,
    isAssignModalOpen,
    setIsAssignModalOpen,
    taskToAssign,
    handleEditTask,
    handleDeleteTask,
    handleUpdateTask,
    handleQuickStatusChange,
    handleAssignCleaner,
    handleAssignCleanerComplete,
  } = useTaskActions();

  const [showPreviewModal, setShowPreviewModal] = React.useState(false);
  const [previewTask, setPreviewTask] = React.useState<Task | null>(null);

  const filteredTasks = React.useMemo(() => 
    filterTasks(tasks, filters), 
    [tasks, filters]
  );

  // Wrapper para handleAssignCleanerComplete que incluye refetch
  const handleAssignCleanerCompleteWithRefetch = React.useCallback((taskId: string, cleanerId: string, cleaners: any[]) => {
    handleAssignCleanerComplete(taskId, cleanerId, cleaners);
    // Refrescar la lista después de asignar
    if (onRefetch) {
      setTimeout(() => onRefetch(), 500); // Pequeño delay para asegurar que la operación se complete
    }
  }, [handleAssignCleanerComplete, onRefetch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 md:py-20">
        <div className="text-center space-y-3 md:space-y-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-b-2 border-blue-600 mx-auto"></div>
            <div className="absolute inset-0 rounded-full border-2 border-gray-200"></div>
          </div>
          <div className="space-y-1 md:space-y-2">
            <p className="text-gray-900 font-semibold text-base md:text-lg">Cargando tareas...</p>
            <p className="text-gray-500 text-sm">Esto puede tomar unos segundos</p>
          </div>
        </div>
      </div>
    );
  }

  if (filteredTasks.length === 0) {
    return (
      <div className="text-center py-12 md:py-20">
        <div className="max-w-sm md:max-w-md mx-auto px-4">
          <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-inner">
            <svg className="w-8 h-8 md:w-10 md:h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="space-y-2 md:space-y-3">
            <h3 className="text-lg md:text-xl font-bold text-gray-900">No se encontraron tareas</h3>
            <p className="text-gray-600 text-sm md:text-base">
              No hay tareas que coincidan con los filtros seleccionados.
            </p>
            <p className="text-xs md:text-sm text-gray-500">
              Prueba ajustando los filtros de búsqueda o creando una nueva tarea.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Default handler if not provided
  const handleCreateReport = onCreateReport || ((task: Task) => {
    console.log('Create report for task:', task.id);
  });

  const handleShowHistory = onShowHistory || ((task: Task) => {
    console.log('Show history for task:', task.id);
  });

  // Responsive grid classes based on device type
  const getGridClasses = () => {
    if (isMobile) {
      return "grid grid-cols-1 gap-4";
    }
    if (isTablet) {
      return "grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6";
    }
    return "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 auto-rows-max";
  };

  return (
    <>
      {/* Modern Responsive Grid Layout */}
      <div className="space-y-4 md:space-y-6">
        {/* Results count */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs md:text-sm text-gray-600 font-medium">
            {filteredTasks.length} {filteredTasks.length === 1 ? 'tarea encontrada' : 'tareas encontradas'}
          </p>
        </div>

        {/* Cards Grid - Responsive */}
        <div className={getGridClasses()}>
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onShowHistory={handleShowHistory}
              onCreateReport={handleCreateReport}
              onEditTask={handleEditTask}
              onDelete={handleDeleteTask}
              onAssignCleaner={handleAssignCleaner}
            />
          ))}
        </div>
      </div>

      {/* Task Details Modal */}
      <TaskDetailsModal
        task={selectedTask}
        open={isModalOpen}
        onOpenChange={handleModalClose}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        openInEditMode={openInEditMode}
      />

      {/* Task Preview Modal */}
      <TaskPreviewModal
        task={previewTask}
        open={showPreviewModal}
        onOpenChange={setShowPreviewModal}
        onCreateReport={handleCreateReport}
        onEditTask={handleEditTask}
        onAssignCleaner={handleAssignCleaner}
      />

      {/* Assign Cleaner Modal */}
      <AssignCleanerModal
        task={taskToAssign}
        open={isAssignModalOpen}
        onOpenChange={setIsAssignModalOpen}
        onAssignCleaner={handleAssignCleanerCompleteWithRefetch}
      />
    </>
  );
});

TasksList.displayName = 'TasksList';
