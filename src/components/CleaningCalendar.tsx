
import { useState, useCallback, useMemo } from "react";
import { ResponsiveCalendarHeader } from "./calendar/ResponsiveCalendarHeader";
import { CalendarLayout } from "./calendar/CalendarLayout";
import { UnassignedTasks } from "./calendar/UnassignedTasks";
import { StatusLegend } from "./calendar/StatusLegend";
import { DragPreview } from "./calendar/DragPreview";
import { CalendarModals } from "./calendar/CalendarModals";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { useCalendarLogic } from "@/hooks/useCalendarLogic";
import { getTaskPosition, isTimeSlotOccupied } from "@/utils/taskPositioning";
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

  // Memoized time slot occupation check wrapper
  const checkTimeSlotOccupied = useCallback((cleanerId: string, hour: number, minute: number) => {
    return isTimeSlotOccupied(cleanerId, hour, minute, assignedTasks, cleaners);
  }, [assignedTasks, cleaners]);

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

  // Calcular fechas para el debug info
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Debug Info</h3>
          <p className="text-sm text-yellow-700 mb-2">
            Hoy: {todayStr} | 
            Mañana: {tomorrowStr} | 
            Fecha del calendario: {currentDate.toISOString().split('T')[0]} | 
            Vista: {currentView} | 
            Tareas cargadas: {tasks.length} | 
            Asignadas: {assignedTasks.length} | 
            Sin asignar: {unassignedTasks.length}
          </p>
          <div className="space-x-2">
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleDeleteAllTasks}
            >
              Eliminar todas las tareas
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleDeleteAllHostawayReservations}
            >
              Eliminar todas las reservas Hostaway
            </Button>
          </div>
        </div>

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
