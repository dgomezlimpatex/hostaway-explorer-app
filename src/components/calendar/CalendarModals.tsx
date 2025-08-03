
import { CreateTaskModal } from "../modals/CreateTaskModal";
import { CreateExtraordinaryServiceModal } from "../modals/CreateExtraordinaryServiceModal";
import { TaskDetailsModal } from "../modals/TaskDetailsModal";
import { Task } from "@/types/calendar";

interface CalendarModalsProps {
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  isExtraordinaryServiceModalOpen: boolean;
  setIsExtraordinaryServiceModalOpen: (open: boolean) => void;
  selectedTask: Task | null;
  isTaskModalOpen: boolean;
  setIsTaskModalOpen: (open: boolean) => void;
  currentDate: Date;
  onCreateTask: (taskData: Omit<Task, 'id'>) => Promise<void>;
  onCreateExtraordinaryService: (serviceData: any) => Promise<void>;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onUnassignTask: (taskId: string) => Promise<void>;
}

export const CalendarModals = ({
  isCreateModalOpen,
  setIsCreateModalOpen,
  isExtraordinaryServiceModalOpen,
  setIsExtraordinaryServiceModalOpen,
  selectedTask,
  isTaskModalOpen,
  setIsTaskModalOpen,
  currentDate,
  onCreateTask,
  onCreateExtraordinaryService,
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

      <CreateExtraordinaryServiceModal
        open={isExtraordinaryServiceModalOpen}
        onOpenChange={setIsExtraordinaryServiceModalOpen}
        onCreateService={onCreateExtraordinaryService}
        currentDate={currentDate}
      />

      <TaskDetailsModal
        task={selectedTask}
        open={isTaskModalOpen}
        onOpenChange={setIsTaskModalOpen}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
        onUnassignTask={onUnassignTask}
      />
    </>
  );
};
