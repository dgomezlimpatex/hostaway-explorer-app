
import { CreateTaskModal } from "../modals/CreateTaskModal";
import { BatchCreateTaskModal } from "../modals/BatchCreateTaskModal";
import { TaskDetailsModal } from "../modals/TaskDetailsModal";
import { Task } from "@/types/calendar";
import type { CalendarPermissions } from "./CalendarActionsContext";

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
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<boolean | void>;
  onDeleteTask: (taskId: string) => Promise<boolean | void>;
  onUnassignTask: (taskId: string) => Promise<boolean | void>;
  /** Calendar permissions of the role; without them the detail keeps its own rule. */
  permissions?: CalendarPermissions;
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
  onUnassignTask,
  permissions
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
        onCreateTask={permissions?.canCreate === false ? undefined : onCreateTask}
        canEditTasks={permissions?.canEdit}
        canDeleteTasks={permissions?.canDelete}
      />
    </>
  );
};
