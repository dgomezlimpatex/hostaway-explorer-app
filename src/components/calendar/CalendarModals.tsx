
import { CreateTaskModal } from "../modals/CreateTaskModal";
import { BatchCreateTaskModal } from "../modals/BatchCreateTaskModal";
import { TaskDetailsModal } from "../modals/TaskDetailsModal";
import { Task } from "@/types/calendar";

interface CalendarModalsProps {
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  isBatchCreateModalOpen: boolean;
  setIsBatchCreateModalOpen: (open: boolean) => void;
  selectedTask: Task | null;
  isTaskModalOpen: boolean;
  setIsTaskModalOpen: (open: boolean) => void;
  currentDate: Date;
  onCreateTask: (taskData: Omit<Task, 'id'>) => Promise<void>;
  onBatchCreateTasks: (tasksData: Omit<Task, 'id'>[]) => Promise<void>;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onUnassignTask: (taskId: string) => Promise<void>;
}

export const CalendarModals = ({
  isCreateModalOpen,
  setIsCreateModalOpen,
  isBatchCreateModalOpen,
  setIsBatchCreateModalOpen,
  selectedTask,
  isTaskModalOpen,
  setIsTaskModalOpen,
  currentDate,
  onCreateTask,
  onBatchCreateTasks,
  onUpdateTask,
  onDeleteTask,
  onUnassignTask
}: CalendarModalsProps) => {
  return (
    <>
      <CreateTaskModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreateTask={onCreateTask}
        currentDate={currentDate}
      />

      <BatchCreateTaskModal
        open={isBatchCreateModalOpen}
        onOpenChange={setIsBatchCreateModalOpen}
        onCreateTasks={onBatchCreateTasks}
      />

      <TaskDetailsModal
        task={selectedTask}
        open={isTaskModalOpen}
        onOpenChange={setIsTaskModalOpen}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
        onUnassignTask={onUnassignTask}
        onCreateTask={onCreateTask}
      />
    </>
  );
};
