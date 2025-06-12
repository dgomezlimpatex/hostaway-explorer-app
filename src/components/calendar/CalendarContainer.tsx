
import { useMemo } from "react";
import { UnassignedTasks } from "./UnassignedTasks";
import { CalendarLayout } from "./CalendarLayout";
import { DragPreview } from "./DragPreview";
import { StatusLegend } from "./StatusLegend";
import { CalendarModals } from "./CalendarModals";
import { Task, Cleaner } from "@/types/calendar";
import { getTaskPosition, isTimeSlotOccupied } from "@/utils/taskPositioning";

interface CalendarContainerProps {
  tasks: Task[];
  cleaners: Cleaner[];
  currentDate: Date;
  timeSlots: string[];
  headerScrollRef: React.RefObject<HTMLDivElement>;
  bodyScrollRef: React.RefObject<HTMLDivElement>;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  selectedTask: Task | null;
  isTaskModalOpen: boolean;
  setIsTaskModalOpen: (open: boolean) => void;
  dragState: any;
  handleDragStart: (e: React.DragEvent, task: Task) => void;
  handleDragEnd: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, cleanerId: string, cleaners: any[], timeSlot?: string) => void;
  handleHeaderScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleBodyScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleTaskClick: (task: Task) => void;
  handleCreateTask: (taskData: Omit<Task, 'id'>) => Promise<void>;
  handleUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  handleDeleteTask: (taskId: string) => Promise<void>;
  handleUnassignTask: (taskId: string) => Promise<void>;
}

export const CalendarContainer = ({
  tasks,
  cleaners,
  currentDate,
  timeSlots,
  headerScrollRef,
  bodyScrollRef,
  isCreateModalOpen,
  setIsCreateModalOpen,
  selectedTask,
  isTaskModalOpen,
  setIsTaskModalOpen,
  dragState,
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDrop,
  handleHeaderScroll,
  handleBodyScroll,
  handleTaskClick,
  handleCreateTask,
  handleUpdateTask,
  handleDeleteTask,
  handleUnassignTask
}: CalendarContainerProps) => {
  // Memoized task filtering
  const { assignedTasks, unassignedTasks } = useMemo(() => {
    const assigned = tasks.filter(task => task.cleaner);
    const unassigned = tasks.filter(task => !task.cleaner);
    return { assignedTasks: assigned, unassignedTasks: unassigned };
  }, [tasks]);

  // Memoized time slot occupation check wrapper
  const checkTimeSlotOccupied = (cleanerId: string, hour: number, minute: number) => {
    return isTimeSlotOccupied(cleanerId, hour, minute, assignedTasks, cleaners);
  };

  return (
    <>
      {/* Main Layout with Unassigned Tasks on Left and Calendar on Right */}
      <div className="flex gap-2 h-[600px] w-full">
        {/* Unassigned Tasks Column - Only show when there are unassigned tasks */}
        {unassignedTasks.length > 0 && (
          <div className="w-80 flex-shrink-0">
            <UnassignedTasks
              tasks={unassignedTasks}
              onTaskClick={handleTaskClick}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          </div>
        )}

        {/* Main Calendar */}
        <div className="flex-1 min-w-0">
          <CalendarLayout
            cleaners={cleaners}
            timeSlots={timeSlots}
            assignedTasks={assignedTasks}
            dragState={dragState}
            headerScrollRef={headerScrollRef}
            bodyScrollRef={bodyScrollRef}
            onHeaderScroll={handleHeaderScroll}
            onBodyScroll={handleBodyScroll}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onTaskClick={handleTaskClick}
            getTaskPosition={getTaskPosition}
            isTimeSlotOccupied={checkTimeSlotOccupied}
          />
        </div>
      </div>

      {/* Drag Preview with Enhanced Styling */}
      {dragState.draggedTask && (
        <DragPreview
          task={dragState.draggedTask}
          isDragging={dragState.isDragging}
          offset={dragState.dragOffset}
        />
      )}

      {/* Enhanced Status Legend */}
      <StatusLegend />

      {/* Modals */}
      <CalendarModals
        isCreateModalOpen={isCreateModalOpen}
        setIsCreateModalOpen={setIsCreateModalOpen}
        selectedTask={selectedTask}
        isTaskModalOpen={isTaskModalOpen}
        setIsTaskModalOpen={setIsTaskModalOpen}
        currentDate={currentDate}
        onCreateTask={handleCreateTask}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onUnassignTask={handleUnassignTask}
      />
    </>
  );
};
