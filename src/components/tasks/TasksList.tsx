
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
      <div className="text-center py-8">
        <p className="text-gray-500">Cargando tareas...</p>
      </div>
    );
  }

  if (filteredTasks.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No se encontraron tareas con los filtros aplicados.</p>
      </div>
    );
  }

  // Default handler if not provided
  const handleCreateReport = onCreateReport || ((task: Task) => {
    console.log('Create report for task:', task.id);
  });

  return (
    <>
      <div className="space-y-4">
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onShowHistory={onShowHistory}
            onCreateReport={handleCreateReport}
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
