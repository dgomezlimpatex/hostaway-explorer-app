
import { CreateTaskModal } from "../modals/CreateTaskModal";
import { TaskDetailsModal } from "../modals/TaskDetailsModal";
import { Task } from "@/types/calendar";

interface CalendarModalsProps {
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  selectedTask: Task | null;
  isTaskModalOpen: boolean;
  setIsTaskModalOpen: (open: boolean) => void;
  currentDate: Date;
  onCreateTask: (taskData: Omit<Task, 'id'>) => Promise<void>;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}

export const CalendarModals = ({
  isCreateModalOpen,
  setIsCreateModalOpen,
  selectedTask,
  isTaskModalOpen,
  setIsTaskModalOpen,
  currentDate,
  onCreateTask,
  onUpdateTask,
  onDeleteTask
}: CalendarModalsProps) => {
  return (
    <>
      <CreateTaskModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreateTask={onCreateTask}
        currentDate={currentDate}
      />

      <TaskDetailsModal
        task={selectedTask}
        open={isTaskModalOpen}
        onOpenChange={setIsTaskModalOpen}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
      />
    </>
  );
};
