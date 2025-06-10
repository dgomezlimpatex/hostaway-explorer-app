
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
  };
  isLoading: boolean;
  onShowHistory?: (task: Task) => void;
}

export const TasksList = ({ tasks, filters, isLoading, onShowHistory }: TasksListProps) => {
  const {
    selectedTask,
    isModalOpen,
    setIsModalOpen,
    isAssignModalOpen,
    setIsAssignModalOpen,
    taskToAssign,
    getStatusColor,
    getStatusText,
    handleEditTask,
    handleDeleteTask,
    handleUpdateTask,
    handleQuickStatusChange,
    handleAssignCleaner,
    handleAssignCleanerComplete,
  } = useTaskActions();

  const filteredTasks = filterTasks(tasks, filters);

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

  return (
    <>
      <div className="space-y-4">
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            onQuickStatusChange={handleQuickStatusChange}
            onAssignCleaner={handleAssignCleaner}
            onShowHistory={onShowHistory}
            getStatusColor={getStatusColor}
            getStatusText={getStatusText}
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
};
