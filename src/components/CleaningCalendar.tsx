
import React, { useCallback, useRef, useEffect, useState, useMemo } from "react";
import { taskMatches, cleanerNameMatches } from "./calendar/utils/calendarSearch";
import { useClients } from "@/hooks/useClients";
import { formatMadridDate } from "@/utils/date";
import { ResponsiveCalendarHeader } from "./calendar/ResponsiveCalendarHeader";
import { CalendarContainer } from "./calendar/CalendarContainer";
import { UnavailableWorkersPanel } from "./calendar/UnavailableWorkersPanel";
import { CleanerMobileCalendar } from "./calendar/CleanerMobileCalendar";
import { CleanerDesktopCalendar } from "./calendar/CleanerDesktopCalendar";
import { ManagerMobileAgendaCalendar } from "./calendar/ManagerMobileAgendaCalendar";
import { CalendarModalsWithSuspense } from "./calendar/LazyCalendarComponents";
import { CalendarFooterSummary } from "./calendar/CalendarFooterSummary";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useCalendarLogic } from "@/hooks/useCalendarLogic";
import { useCalendarNavigation } from "@/hooks/useCalendarNavigation";
import { useDeviceType } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useSede } from "@/contexts/SedeContext";
import { Loader2 } from "lucide-react";
import type { Client } from "@/types/client";

const CleaningCalendar = () => {
  const { isMobile } = useDeviceType();
  const { userRole } = useAuth();
  const hasLoadedOnce = useRef(false);
  const { isLoading: authGuardLoading, hasFullAccess, hasSedeAccess } = useAuthGuard();
  const { isInitialized: sedeInitialized, loading: sedeLoading, activeSede } = useSede();

  // Calendar logic and data
  const {
    tasks,
    cleaners,
    currentDate,
    currentView,
    timeSlots,
    headerScrollRef,
    bodyScrollRef,
    isLoading,
    selectedTask,
    isTaskModalOpen,
    isCreateModalOpen,
    isBatchCreateModalOpen,
    isExtraordinaryServiceModalOpen,
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    availability,
    setCurrentDate,
    setCurrentView,
    navigateDate,
    goToToday,
    handleNewTask,
    handleNewBatchTask,
    handleNewExtraordinaryService,
    handleCreateTask,
    handleBatchCreateTasks,
    handleCreateExtraordinaryService,
    handleTaskClick,
    handleUpdateTask,
    handleDeleteTask,
    handleDeleteAllTasks,
    handleUnassignTask,
    setIsTaskModalOpen,
    setIsCreateModalOpen,
    setIsBatchCreateModalOpen,
    setIsExtraordinaryServiceModalOpen,
  } = useCalendarLogic();
  
  // Track if we've loaded data at least once to avoid full-screen loading on refetches
  useEffect(() => {
    if (tasks.length > 0 || cleaners.length > 0) {
      hasLoadedOnce.current = true;
    }
  }, [tasks.length, cleaners.length]);

  // Separate tasks into assigned and unassigned
  const assignedTasks = tasks.filter(task => task.cleanerId && task.cleaner);
  const unassignedTasks = tasks.filter(task => !task.cleanerId && !task.cleaner);

  // Admin filters (filters tasks/cleaners shown in calendar)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientFilters, setSelectedClientFilters] = useState<string[]>([]);
  const [selectedCleanerFilters, setSelectedCleanerFilters] = useState<string[]>([]);
  const isAdminSearchEnabled = userRole !== 'cleaner';
  const { data: clientsData = [] } = useClients();
  const clientsList = clientsData as Client[];

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    clientsList.forEach((c) => {
      if (c?.id && c?.nombre) map.set(c.id, c.nombre);
    });
    return map;
  }, [clientsList]);

  const clientFilterOptions = useMemo(() => {
    return clientsList
      .filter((c) => c?.isActive !== false)
      .map((c) => ({ id: c.id, name: c.nombre }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clientsList]);

  const cleanerFilterOptions = useMemo(() => {
    return [...cleaners]
      .map(c => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cleaners]);

  const matchingCleanerIds = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) return null;
    const ids = new Set<string>();
    cleaners.forEach(c => {
      if (cleanerNameMatches(c.name, term)) ids.add(c.id);
    });
    return ids;
  }, [searchTerm, cleaners]);

  const clientFilterSet = useMemo(() => new Set(selectedClientFilters), [selectedClientFilters]);
  const cleanerFilterSet = useMemo(() => new Set(selectedCleanerFilters), [selectedCleanerFilters]);

  const filteredTasks = useMemo(() => {
    if (!isAdminSearchEnabled) return tasks;
    const term = searchTerm.trim();
    const hasClientFilter = clientFilterSet.size > 0;
    const hasCleanerFilter = cleanerFilterSet.size > 0;
    const hasSearch = !!term;

    if (!hasClientFilter && !hasCleanerFilter && !hasSearch) return tasks;

    return tasks.filter(t => {
      // Filtro por cliente
      if (hasClientFilter && (!t.clienteId || !clientFilterSet.has(t.clienteId))) return false;

      // Filtro por empleado: las sin asignar siempre pasan
      if (hasCleanerFilter && t.cleanerId && !cleanerFilterSet.has(t.cleanerId)) return false;

      // Búsqueda libre: las sin asignar siempre se muestran
      if (hasSearch) {
        if (!t.cleanerId) return true;
        const cleanerHit = matchingCleanerIds?.has(t.cleanerId) ?? false;
        const fieldHit = taskMatches(t, term, clientNameById);
        if (!cleanerHit && !fieldHit) return false;
      }

      return true;
    });
  }, [tasks, searchTerm, matchingCleanerIds, isAdminSearchEnabled, clientNameById, clientFilterSet, cleanerFilterSet]);

  const filteredCleaners = useMemo(() => {
    if (!isAdminSearchEnabled) return cleaners;
    const term = searchTerm.trim();
    const hasCleanerFilter = cleanerFilterSet.size > 0;
    const hasClientFilter = clientFilterSet.size > 0;
    const hasSearch = !!term;

    if (hasCleanerFilter) {
      return cleaners.filter(c => cleanerFilterSet.has(c.id));
    }
    if (!hasSearch && !hasClientFilter) return cleaners;

    const cleanersWithTasks = new Set(
      filteredTasks.map(t => t.cleanerId).filter(Boolean) as string[]
    );
    return cleaners.filter(c =>
      (matchingCleanerIds?.has(c.id) ?? false) || cleanersWithTasks.has(c.id)
    );
  }, [cleaners, searchTerm, matchingCleanerIds, filteredTasks, isAdminSearchEnabled, cleanerFilterSet, clientFilterSet]);

  const searchResultsLabel = useMemo(() => {
    const hasAnyFilter = !!searchTerm.trim() || clientFilterSet.size > 0 || cleanerFilterSet.size > 0;
    if (!hasAnyFilter) return undefined;
    return `${filteredTasks.length} tareas · ${filteredCleaners.length} empleados`;
  }, [searchTerm, clientFilterSet, cleanerFilterSet, filteredTasks.length, filteredCleaners.length]);

  // Sync horizontal scroll from timeline body to header only
  const handleHeaderScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    if (headerScrollRef.current && headerScrollRef.current.scrollLeft !== scrollLeft) {
      headerScrollRef.current.scrollLeft = scrollLeft;
    }
  }, [headerScrollRef]);

  // Vertical scroll only (avoid horizontal sync on body container to prevent left column shift)
  const handleBodyScroll = useCallback((_e: React.UIEvent<HTMLDivElement>) => {
    // no-op
  }, []);

  // Wait for auth and sede initialization before showing calendar
  if (authGuardLoading || !sedeInitialized || sedeLoading || (hasSedeAccess && !activeSede?.id)) {
    console.log('🔄 CleaningCalendar: Waiting for initialization', { 
      authGuardLoading, 
      sedeInitialized, 
      sedeLoading 
    });
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <LoadingSpinner size="lg" text="Preparando sede activa..." />
      </div>
    );
  }

  // Check if user has full access
  if (!hasFullAccess) {
    console.log('⚠️ CleaningCalendar: User does not have full access');
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <LoadingSpinner size="lg" text="Verificando permisos..." />
      </div>
    );
  }

  // Only show full-screen loading on the very first load, not during refetches
  const isInitialLoad = !hasLoadedOnce.current && isLoading && (!tasks || tasks.length === 0);
  if (isInitialLoad) {
    console.log('🔄 CleaningCalendar: Showing initial loading spinner', { isLoading, tasksLength: tasks?.length || 0 });
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <LoadingSpinner size="lg" text={`Cargando calendario${activeSede?.nombre ? ` de ${activeSede.nombre}` : ''}...`} />
      </div>
    );
  }

  // Show subtle loading indicator during refetches (non-blocking)
  const isRefetching = hasLoadedOnce.current && isLoading;

  console.log('🎯 CleaningCalendar: Determining view to render', {
    isMobile,
    userRole,
    tasksLength: tasks?.length || 0,
    cleanersLength: cleaners?.length || 0,
    isLoading
  });

  // Mobile views - render specific mobile interfaces
  if (isMobile) {
    console.log('📱 CleaningCalendar: Rendering mobile view');
    if (userRole === 'cleaner') {
      console.log('Rendering mobile cleaner view');
      
      // Calculate current day and tomorrow's tasks for the cleaner
      const currentDateStr = formatMadridDate(currentDate);
      
      // Calculate tomorrow's date
      const tomorrowDate = new Date(currentDate);
      tomorrowDate.setDate(currentDate.getDate() + 1);
      const tomorrowDateStr = formatMadridDate(tomorrowDate);
      
      // Filter tasks for current date and tomorrow - cleaner can navigate to see future tasks
      const todayTasks = tasks.filter(task => task.date === currentDateStr);
      const tomorrowTasks = tasks.filter(task => task.date === tomorrowDateStr);
      
      console.log('Mobile cleaner - Tasks for', currentDateStr + ':', todayTasks.length, 'Tomorrow tasks:', tomorrowTasks.length);
      console.log('All available tasks:', tasks.length, 'Date range:', tasks.length > 0 ? `${tasks[0]?.date} to ${tasks[tasks.length-1]?.date}` : 'No tasks');
      console.log('Tasks dates available:', [...new Set(tasks.map(task => task.date))].sort());
      console.log('Current date tasks found:', todayTasks.map(task => ({ id: task.id, date: task.date, property: task.property })));
      
      return (
        <>
          <div className="h-screen flex flex-col bg-background text-foreground transition-colors duration-300 relative">
            {/* Subtle loading indicator during refetches */}
            {isRefetching && (
              <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-md">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Actualizando...</span>
              </div>
            )}
            <CleanerMobileCalendar
              currentDate={currentDate}
              onNavigateDate={navigateDate}
              onDateChange={(date) => {
                console.log('Calendar - navigating to selected date:', formatMadridDate(date));
                setCurrentDate(date);
              }}
              handleTaskClick={handleTaskClick}
              todayTasks={todayTasks}
              tomorrowTasks={tomorrowTasks}
            />
          </div>
          
          {/* Modals for mobile cleaner view */}
          <CalendarModalsWithSuspense
            isCreateModalOpen={false} // Cleaners can't create tasks
            setIsCreateModalOpen={() => {}} // No-op for cleaners
            isBatchCreateModalOpen={false} // Cleaners can't create batch tasks
            setIsBatchCreateModalOpen={() => {}} // No-op for cleaners
            isExtraordinaryServiceModalOpen={false} // Cleaners can't create extraordinary services
            setIsExtraordinaryServiceModalOpen={() => {}} // No-op for cleaners
            selectedTask={selectedTask}
            isTaskModalOpen={isTaskModalOpen}
            setIsTaskModalOpen={setIsTaskModalOpen}
            currentDate={currentDate}
            onCreateTask={() => {}} // No-op for cleaners
            onBatchCreateTasks={() => {}} // No-op for cleaners
            onCreateExtraordinaryService={() => {}} // No-op for cleaners
            onUpdateTask={handleUpdateTask}
            onDeleteTask={() => {}} // Cleaners can't delete tasks
            onUnassignTask={() => {}} // Cleaners can't unassign tasks
          />
        </>
      );
    } else {
      // Mobile manager/admin view
      console.log('Rendering mobile manager view');
      
      return (
        <>
          <div className="h-screen flex flex-col bg-background text-foreground transition-colors duration-300 relative overflow-hidden">
            {/* Subtle loading indicator during refetches */}
            {isRefetching && (
              <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-md">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Actualizando...</span>
              </div>
            )}
            <ManagerMobileAgendaCalendar
              currentDate={currentDate}
              tasks={tasks}
              cleaners={cleaners}
              onNavigateDate={navigateDate}
              onGoToToday={goToToday}
              onTaskClick={handleTaskClick}
              onNewTask={handleNewTask}
              onNewBatchTask={handleNewBatchTask}
              onNewExtraordinaryService={handleNewExtraordinaryService}
            />
          </div>
          
          {/* Modals for mobile manager view */}
          <CalendarModalsWithSuspense
            isCreateModalOpen={isCreateModalOpen}
            setIsCreateModalOpen={setIsCreateModalOpen}
            isBatchCreateModalOpen={isBatchCreateModalOpen}
            setIsBatchCreateModalOpen={setIsBatchCreateModalOpen}
            isExtraordinaryServiceModalOpen={isExtraordinaryServiceModalOpen}
            setIsExtraordinaryServiceModalOpen={setIsExtraordinaryServiceModalOpen}
            selectedTask={selectedTask}
            isTaskModalOpen={isTaskModalOpen}
            setIsTaskModalOpen={setIsTaskModalOpen}
            currentDate={currentDate}
            onCreateTask={handleCreateTask}
            onBatchCreateTasks={handleBatchCreateTasks}
            onCreateExtraordinaryService={handleCreateExtraordinaryService}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onUnassignTask={handleUnassignTask}
          />
        </>
      );
    }
  }

  // Desktop views
  if (userRole === 'cleaner') {
    console.log('🖥️ CleaningCalendar: Rendering desktop cleaner view');
    
    // Calculate today's and tomorrow's tasks for the cleaner
    const currentDateStr = formatMadridDate(currentDate);
    
    // Calculate tomorrow's date more simply
    const tomorrowDate = new Date(currentDate);
    tomorrowDate.setDate(currentDate.getDate() + 1);
    const tomorrowDateStr = formatMadridDate(tomorrowDate);
    
    const todayTasks = tasks.filter(task => task.date === currentDateStr);
    const tomorrowTasks = tasks.filter(task => task.date === tomorrowDateStr);
    
    console.log('Desktop cleaner - Today tasks:', todayTasks.length, 'Tomorrow tasks:', tomorrowTasks.length);
    console.log('All tasks:', tasks.length, 'Current date:', currentDateStr, 'Tomorrow date:', tomorrowDateStr);
    
    return (
      <>
        {/* Subtle loading indicator during refetches */}
        {isRefetching && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-md">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Actualizando...</span>
          </div>
        )}
        <CleanerDesktopCalendar
          currentDate={currentDate}
          onNavigateDate={navigateDate}
          onDateChange={(date) => {
            console.log('Calendar - navigating to selected date:', formatMadridDate(date));
            setCurrentDate(date);
          }}
          handleTaskClick={handleTaskClick}
          todayTasks={todayTasks}
          tomorrowTasks={tomorrowTasks}
        />
        
        {/* Modals for desktop cleaner view */}
        <CalendarModalsWithSuspense
          isCreateModalOpen={false} // Cleaners can't create tasks
          setIsCreateModalOpen={() => {}} // No-op for cleaners
          isBatchCreateModalOpen={false} // Cleaners can't create batch tasks
          setIsBatchCreateModalOpen={() => {}} // No-op for cleaners
          isExtraordinaryServiceModalOpen={false} // Cleaners can't create extraordinary services
          setIsExtraordinaryServiceModalOpen={() => {}} // No-op for cleaners
          selectedTask={selectedTask}
          isTaskModalOpen={isTaskModalOpen}
          setIsTaskModalOpen={setIsTaskModalOpen}
          currentDate={currentDate}
          onCreateTask={() => {}} // No-op for cleaners
          onBatchCreateTasks={() => {}} // No-op for cleaners
          onCreateExtraordinaryService={() => {}} // No-op for cleaners
          onUpdateTask={handleUpdateTask}
          onDeleteTask={() => {}} // Cleaners can't delete tasks
          onUnassignTask={() => {}} // Cleaners can't unassign tasks
        />
      </>
    );
  }

  // Desktop manager/admin view
  console.log('🖥️ CleaningCalendar: Rendering desktop manager/admin view', {
    userRole,
    tasksLength: tasks.length,
    cleanersLength: cleaners.length,
    currentDateStr: formatMadridDate(currentDate)
  });
  
  return (
    <div className="h-screen flex flex-col bg-background text-foreground transition-colors duration-300 relative overflow-hidden">
      {/* Subtle loading indicator during refetches */}
      {isRefetching && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-md">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Actualizando...</span>
        </div>
      )}
      <div className="flex-1 flex flex-col gap-3 px-2 py-3 max-w-full overflow-hidden">        
        {/* Enhanced Responsive Header */}
        <ResponsiveCalendarHeader
          currentDate={currentDate}
          currentView={currentView}
          onNavigateDate={navigateDate}
          onGoToToday={goToToday}
          onViewChange={setCurrentView}
          onNewTask={handleNewTask}
          onNewBatchTask={handleNewBatchTask}
          onNewExtraordinaryService={handleNewExtraordinaryService}
          showSearch={isAdminSearchEnabled}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchResultsLabel={searchResultsLabel}
          clientFilterOptions={clientFilterOptions}
          cleanerFilterOptions={cleanerFilterOptions}
          selectedClientFilters={selectedClientFilters}
          selectedCleanerFilters={selectedCleanerFilters}
          onClientFiltersChange={setSelectedClientFilters}
          onCleanerFiltersChange={setSelectedCleanerFilters}
        />

        {/* Panel desplegable de trabajadoras no disponibles */}
        <UnavailableWorkersPanel
          cleaners={cleaners}
          currentDate={currentDate}
          currentView={currentView}
          tasks={tasks}
        />

        {/* Calendar Container - takes available space */}
        <div className="flex-1 flex flex-col min-h-0">
          <CalendarContainer
            tasks={filteredTasks}
            cleaners={filteredCleaners}
            currentDate={currentDate}
            timeSlots={timeSlots}
            availability={availability}
            headerScrollRef={headerScrollRef}
            bodyScrollRef={bodyScrollRef}
            isCreateModalOpen={isCreateModalOpen}
            setIsCreateModalOpen={setIsCreateModalOpen}
            isBatchCreateModalOpen={isBatchCreateModalOpen}
            setIsBatchCreateModalOpen={setIsBatchCreateModalOpen}
            isExtraordinaryServiceModalOpen={isExtraordinaryServiceModalOpen}
            setIsExtraordinaryServiceModalOpen={setIsExtraordinaryServiceModalOpen}
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
            handleBatchCreateTasks={handleBatchCreateTasks}
            handleCreateExtraordinaryService={handleCreateExtraordinaryService}
            handleUpdateTask={handleUpdateTask}
            handleDeleteTask={handleDeleteTask}
            handleUnassignTask={handleUnassignTask}
            onNavigateDate={navigateDate}
          />
        </div>

        {/* Footer-resumen con totales y leyenda de clientes */}
        <div className="flex-shrink-0">
          <CalendarFooterSummary
            tasks={filteredTasks.filter(t => t.date === formatMadridDate(currentDate))}
            cleaners={filteredCleaners}
          />
        </div>
      </div>
    </div>
  );
};

export default CleaningCalendar;
