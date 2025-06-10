
import { useState } from "react";
import { ResponsiveCalendarHeader } from "./calendar/ResponsiveCalendarHeader";
import { CalendarLayout } from "./calendar/CalendarLayout";
import { UnassignedTasks } from "./calendar/UnassignedTasks";
import { StatusLegend } from "./calendar/StatusLegend";
import { DragPreview } from "./calendar/DragPreview";
import { CalendarModals } from "./calendar/CalendarModals";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useCalendarLogic } from "@/hooks/useCalendarLogic";
import { getTaskPosition, isTimeSlotOccupied } from "@/utils/taskPositioning";

const CleaningCalendar = () => {
  const {
    tasks,
    cleaners,
    currentDate,
    currentView,
    isLoading,
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
    setCurrentView,
    navigateDate,
    goToToday,
    handleNewTask,
    handleCreateTask,
    handleTaskClick,
    handleUpdateTask,
    handleDeleteTask,
    handleUnassignTask
  } = useCalendarLogic();

  // Handle scroll synchronization
  const handleHeaderScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // Get tasks assigned to cleaners
  const assignedTasks = tasks.filter(task => task.cleaner);
  const unassignedTasks = tasks.filter(task => !task.cleaner);

  // Wrapper for time slot occupation check
  const checkTimeSlotOccupied = (cleanerId: string, hour: number, minute: number) => {
    return isTimeSlotOccupied(cleanerId, hour, minute, assignedTasks, cleaners);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <LoadingSpinner size="lg" text="Cargando calendario..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="space-y-6 container-responsive py-6">
        {/* Enhanced Responsive Header */}
        <ResponsiveCalendarHeader
          currentDate={currentDate}
          currentView={currentView}
          onNavigateDate={navigateDate}
          onGoToToday={goToToday}
          onViewChange={setCurrentView}
          onNewTask={handleNewTask}
        />

        {/* Enhanced Unassigned Tasks - Only show when there are unassigned tasks */}
        {unassignedTasks.length > 0 && (
          <UnassignedTasks
            tasks={unassignedTasks}
            onTaskClick={handleTaskClick}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        )}

        {/* Main Calendar with Enhanced Design */}
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
      </div>
    </div>
  );
};

export default CleaningCalendar;
