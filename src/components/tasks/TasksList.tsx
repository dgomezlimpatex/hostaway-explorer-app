
import React from 'react';
import { Task } from "@/types/calendar";
import { TaskDetailsModal } from '@/components/modals/TaskDetailsModal';
import { AssignCleanerModal } from '@/components/modals/AssignCleanerModal';
import { TaskCard } from './components/TaskCard';
import { useTaskActions } from './hooks/useTaskActions';
import { filterTasks } from './utils/taskFilters';

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
}

export const TasksList = React.memo(({ 
  tasks, 
  filters, 
  isLoading, 
  onShowHistory,
  onCreateReport 
}: TasksListProps) => {
  const {
    selectedTask,
    isModalOpen,
    setIsModalOpen,
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

  const filteredTasks = React.useMemo(() => 
    filterTasks(tasks, filters), 
    [tasks, filters]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Cargando tareas...</p>
        </div>
      </div>
    );
  }

  if (filteredTasks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-gray-50 rounded-xl p-8 max-w-md mx-auto">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium mb-2">No se encontraron tareas</p>
          <p className="text-gray-500 text-sm">Prueba ajustando los filtros de búsqueda</p>
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

  return (
    <>
      {/* Modern Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onShowHistory={handleShowHistory}
            onCreateReport={handleCreateReport}
            onEditTask={handleEditTask}
            onDelete={handleDeleteTask}
          />
        ))}
      </div>

      {/* Task Details Modal */}
      <TaskDetailsModal
        task={selectedTask}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
      />

      {/* Assign Cleaner Modal */}
      <AssignCleanerModal
        task={taskToAssign}
        open={isAssignModalOpen}
        onOpenChange={setIsAssignModalOpen}
        onAssignCleaner={handleAssignCleanerComplete}
      />
    </>
  );
});

TasksList.displayName = 'TasksList';
