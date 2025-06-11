
import { useState, useCallback, useMemo } from "react";
import { ResponsiveCalendarHeader } from "./calendar/ResponsiveCalendarHeader";
import { DebugInfo } from "./calendar/DebugInfo";
import { CalendarContainer } from "./calendar/CalendarContainer";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useCalendarLogic } from "@/hooks/useCalendarLogic";
import { hostawaySync } from "@/services/hostawaySync";
import { useToast } from "@/hooks/use-toast";

const CleaningCalendar = () => {
  const { toast } = useToast();
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
    handleDeleteAllTasks,
    handleUnassignTask
  } = useCalendarLogic();

  // Memoized scroll handlers with useCallback
  const handleHeaderScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }, []);

  const handleBodyScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }, []);

  // Memoized task filtering
  const { assignedTasks, unassignedTasks } = useMemo(() => {
    const assigned = tasks.filter(task => task.cleaner);
    const unassigned = tasks.filter(task => !task.cleaner);
    return { assignedTasks: assigned, unassignedTasks: unassigned };
  }, [tasks]);

  // Handle deleting all Hostaway reservations
  const handleDeleteAllHostawayReservations = async () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar TODAS las reservas de Hostaway de la base de datos? Esta acción no se puede deshacer.')) {
      try {
        await hostawaySync.deleteAllHostawayReservations();
        toast({
          title: "Reservas eliminadas",
          description: "Todas las reservas de Hostaway han sido eliminadas de la base de datos.",
        });
      } catch (error) {
        console.error('Error eliminando reservas de Hostaway:', error);
        toast({
          title: "Error",
          description: "No se pudieron eliminar las reservas de Hostaway.",
          variant: "destructive",
        });
      }
    }
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

        {/* Debug info and controls */}
        <DebugInfo
          currentDate={currentDate}
          currentView={currentView}
          tasks={tasks}
          assignedTasks={assignedTasks}
          unassignedTasks={unassignedTasks}
          onDeleteAllTasks={handleDeleteAllTasks}
          onDeleteAllHostawayReservations={handleDeleteAllHostawayReservations}
        />

        {/* Calendar Container */}
        <CalendarContainer
          tasks={tasks}
          cleaners={cleaners}
          currentDate={currentDate}
          timeSlots={timeSlots}
          headerScrollRef={headerScrollRef}
          bodyScrollRef={bodyScrollRef}
          isCreateModalOpen={isCreateModalOpen}
          setIsCreateModalOpen={setIsCreateModalOpen}
          selectedTask={selectedTask}
          isTaskModalOpen={isTaskModalOpen}
          setIsTaskModalOpen={setIsTaskModalOpen}
          dragState={dragState}
          handleDragStart={handleDragStart}
          handleDragEnd={handleDragEnd}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          handleHeaderScroll={handleHeaderScroll}
          handleBodyScroll={handleBodyScroll}
          handleTaskClick={handleTaskClick}
          handleCreateTask={handleCreateTask}
          handleUpdateTask={handleUpdateTask}
          handleDeleteTask={handleDeleteTask}
          handleUnassignTask={handleUnassignTask}
        />
      </div>
    </div>
  );
};

export default CleaningCalendar;
