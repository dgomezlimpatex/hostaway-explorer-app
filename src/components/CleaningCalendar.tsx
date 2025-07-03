
import { useCallback } from "react";
import { ResponsiveCalendarHeader } from "./calendar/ResponsiveCalendarHeader";
import { CalendarContainer } from "./calendar/CalendarContainer";
import { CleanerMobileCalendar } from "./calendar/CleanerMobileCalendar";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useCalendarLogic } from "@/hooks/useCalendarLogic";
import { useDeviceType } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";

const CleaningCalendar = () => {
  const { isMobile } = useDeviceType();
  const { userRole } = useAuth();

const {
    tasks,
    cleaners,
    currentDate,
    currentView,
    isLoading,
    timeSlots,
    availability,
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
  }, [bodyScrollRef]);

  const handleBodyScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }, [headerScrollRef]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <LoadingSpinner size="lg" text="Cargando calendario..." />
      </div>
    );
  }

  // Mobile cleaner view - render specific mobile interface
  if (isMobile && userRole === 'cleaner') {
    console.log('Rendering mobile cleaner view');
    
    // Calculate today's and tomorrow's tasks for the cleaner
    const currentDateStr = currentDate.toISOString().split('T')[0];
    const tomorrow = new Date(currentDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateStr = tomorrow.toISOString().split('T')[0];
    
    const todayTasks = tasks.filter(task => task.date === currentDateStr);
    const tomorrowTasks = tasks.filter(task => task.date === tomorrowDateStr);
    
    console.log('Mobile cleaner - Today tasks:', todayTasks.length, 'Tomorrow tasks:', tomorrowTasks.length);
    
    return (
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <CleanerMobileCalendar
          currentDate={currentDate}
          onNavigateDate={navigateDate}
          onDateChange={(date) => {
            // Para cambiar fecha directamente usamos el hook de navegación
            goToToday(); // Esto actualizará la fecha
          }}
          handleTaskClick={handleTaskClick}
          todayTasks={todayTasks}
          tomorrowTasks={tomorrowTasks}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="space-y-4 px-2 py-4 max-w-full">
        {/* Enhanced Responsive Header */}
        <ResponsiveCalendarHeader
          currentDate={currentDate}
          currentView={currentView}
          onNavigateDate={navigateDate}
          onGoToToday={goToToday}
          onViewChange={setCurrentView}
          onNewTask={handleNewTask}
        />

        {/* Calendar Container */}
        <CalendarContainer
          tasks={tasks}
          cleaners={cleaners}
          currentDate={currentDate}
          timeSlots={timeSlots}
          availability={availability}
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
          onNavigateDate={navigateDate}
        />
      </div>
    </div>
  );
};

export default CleaningCalendar;
