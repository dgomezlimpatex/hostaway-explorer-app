
import React, { useCallback, useRef, useEffect, useState, useMemo } from "react";
import { cleanerNameMatches, filterCalendarTasks } from "./calendar/utils/calendarSearch";
import { useClients } from "@/hooks/useClients";
import { formatMadridDate } from "@/utils/date";
import { filterTasksByQueryRange } from "@/utils/taskQueryRange";
import { civilDateToLocalDate, getVisibleDays, isMultiDayView } from "./calendar/utils/multiDayCalendar";
import { getTaskAssignedCleanerIds } from "@/utils/taskAssignments";
import { ResponsiveCalendarHeader } from "./calendar/ResponsiveCalendarHeader";
import { CalendarContainer } from "./calendar/CalendarContainer";
import { UnavailableWorkersPanel } from "./calendar/UnavailableWorkersPanel";
import { ManagerMobileAgendaCalendar } from "./calendar/ManagerMobileAgendaCalendar";
import { CalendarModalsWithSuspense } from "./calendar/LazyCalendarComponents";
import { CalendarFooterSummary } from "./calendar/CalendarFooterSummary";
import { CalendarActionsProvider } from "./calendar/CalendarActionsContext";
import { useCalendarPermissions } from "./calendar/useCalendarCapabilities";
import { parseCalendarUrlState, withoutParams, writeCalendarUrlState } from "./calendar/utils/calendarUrlState";
import { DEFAULT_SCALE, type TimelineZoom } from "./calendar/utils/timelineScale";
import { getFooterPeriodLabel } from "./calendar/utils/calendarDisplay";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { useCalendarLogic } from "@/hooks/useCalendarLogic";
import { useDeviceType } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useSede } from "@/contexts/SedeContext";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import type { Client } from "@/types/client";
import { useSearchParams } from "react-router-dom";

const formatUpdatedAt = (timestamp?: number) =>
  timestamp ? new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(timestamp) : null;

const CleaningCalendar = () => {
  const { isMobile } = useDeviceType();
  const { userRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // Filters, search and zoom start from the URL (date and view are read by
  // useCalendarNavigation on its first render).
  const initialUrlState = useMemo(() => parseCalendarUrlState(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps
  const hasLoadedOnce = useRef(false);
  const deepLinkTaskOpened = useRef(false);
  const deepLinkTaskLookedUp = useRef(false);
  const { isLoading: authGuardLoading, hasFullAccess, hasSedeAccess, isAuthenticated, hasRole } = useAuthGuard();
  const { isInitialized: sedeInitialized, loading: sedeLoading, activeSede } = useSede();
  const permissions = useCalendarPermissions();

  // Calendar logic and data
  const {
    tasks,
    pendingCalendarMove,
    cleaners,
    currentDate,
    currentView,
    timeSlots,
    headerScrollRef,
    bodyScrollRef,
    isLoading,
    isTasksError,
    refetchTasks,
    tasksUpdatedAt,
    selectedTask,
    isTaskModalOpen,
    isCreateModalOpen,
    isBatchCreateModalOpen,
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
    handleCreateTask,
    handleBatchCreateTasks,
    handleTaskClick,
    handleUpdateTask,
    handleDeleteTask,
    handleUnassignTask,
    handleRemoveCleanerFromTask,
    validateScheduleChange,
    setIsTaskModalOpen,
    setIsCreateModalOpen,
    setIsBatchCreateModalOpen,
    confirm,
    confirmDialog,
  } = useCalendarLogic({ canSeeAbsenceDetails: permissions.canSeeAbsenceDetails });

  const deepLinkTaskId = initialUrlState.task;

  useEffect(() => {
    if (!deepLinkTaskId || deepLinkTaskOpened.current) return;
    const task = tasks.find(item => item.id === deepLinkTaskId || item.originalTaskId === deepLinkTaskId);
    if (task) {
      handleTaskClick(task);
      deepLinkTaskOpened.current = true;
      return;
    }
    // ?task without (or with a wrong) ?date: look up the task's day once and
    // move there, so the link works for any date, not only today.
    if (isLoading || deepLinkTaskLookedUp.current) return;
    deepLinkTaskLookedUp.current = true;
    void Promise.resolve(
      supabase.from('tasks').select('date').eq('id', deepLinkTaskId).maybeSingle()
    ).then(({ data }) => {
      const date = (data as { date?: string } | null)?.date;
      if (date && date !== formatMadridDate(currentDate)) setCurrentDate(civilDateToLocalDate(date));
    }).catch(() => { /* the calendar simply stays on the date shown */ });
  }, [deepLinkTaskId, handleTaskClick, tasks, isLoading, currentDate, setCurrentDate]);


  // Track if we've loaded data at least once to avoid full-screen loading on refetches
  useEffect(() => {
    if (tasks.length > 0 || cleaners.length > 0) {
      hasLoadedOnce.current = true;
    }
  }, [tasks.length, cleaners.length]);

  // Admin filters (filters tasks/cleaners shown in calendar)
  const [searchTerm, setSearchTerm] = useState(initialUrlState.q);
  const [selectedClientFilters, setSelectedClientFilters] = useState<string[]>(initialUrlState.clients);
  const [selectedCleanerFilters, setSelectedCleanerFilters] = useState<string[]>(initialUrlState.cleaners);
  const [zoom, setZoom] = useState<TimelineZoom>(initialUrlState.zoom ?? 'normal');
  const isAdminSearchEnabled = userRole !== 'cleaner';
  const { data: clientsData = [] } = useClients();
  const clientsList = clientsData as Client[];

  // Keep date, view, filters, search and zoom in the URL (replace: no history spam).
  const currentDayStr = formatMadridDate(currentDate);
  useEffect(() => {
    const written = writeCalendarUrlState(searchParams, {
      date: currentDayStr,
      view: currentView,
      clients: selectedClientFilters,
      cleaners: selectedCleanerFilters,
      q: searchTerm,
      zoom,
    });
    // The task link opens once; afterwards it leaves the URL.
    const next = deepLinkTaskOpened.current ? withoutParams(written, ['task']) : written;
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [currentDayStr, currentView, selectedClientFilters, selectedCleanerFilters, searchTerm, zoom, searchParams, setSearchParams, isTaskModalOpen]);

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
    return filterCalendarTasks(tasks, {
      term: searchTerm,
      clientIds: clientFilterSet,
      cleanerIds: cleanerFilterSet,
      matchingCleanerIds,
      clientNameById,
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
      filteredTasks.flatMap((task) => getTaskAssignedCleanerIds(task))
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

  const unassignedNote = cleanerFilterSet.size > 0
    ? 'Con el filtro de empleado, las sin asignar se siguen mostrando.'
    : undefined;

  const isMultiDay = isMultiDayView(currentView);
  // Week view starts on Monday, so range-based panels use the first visible day.
  const rangeStartDate = useMemo(
    () => civilDateToLocalDate(getVisibleDays(currentDate, currentView)[0]),
    [currentDate, currentView],
  );

  const summaryTasks = useMemo(
    () => isMultiDay
      ? filterTasksByQueryRange(filteredTasks, currentDate, currentView)
      : filteredTasks.filter(t => t.date === formatMadridDate(currentDate)),
    [isMultiDay, filteredTasks, currentDate, currentView],
  );

  const handleSelectDay = useCallback((day: string) => {
    setCurrentDate(civilDateToLocalDate(day));
    setCurrentView('day');
  }, [setCurrentDate, setCurrentView]);

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

  const pageActions = useMemo(
    () => ({ permissions, validateScheduleChange, scale: DEFAULT_SCALE }),
    [permissions, validateScheduleChange],
  );

  // Authenticated with a role but without any sede: say it instead of spinning forever.
  if (!authGuardLoading && isAuthenticated && hasRole && !hasSedeAccess) {
    return (
      <div className="flex items-center justify-center h-screen bg-background p-6">
        <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm" role="alert">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-warning" aria-hidden />
          <h1 className="text-lg font-semibold">No tienes ninguna sede asignada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            El calendario muestra las tareas de una sede. Pide a un administrador que te asigne una.
          </p>
        </div>
      </div>
    );
  }

  // Wait for auth and sede initialization before showing calendar
  if (authGuardLoading || !sedeInitialized || sedeLoading || (hasSedeAccess && !activeSede?.id)) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <LoadingSpinner size="lg" text="Preparando sede activa..." />
      </div>
    );
  }

  // Check if user has full access
  if (!hasFullAccess) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <LoadingSpinner size="lg" text="Verificando permisos..." />
      </div>
    );
  }

  // A failed load with nothing to show: never present it as an empty day.
  if (isTasksError && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-background p-6">
        <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm" role="alert">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-danger" aria-hidden />
          <h1 className="text-lg font-semibold">No se han podido cargar las tareas</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Comprueba la conexión y vuelve a intentarlo. El calendario no muestra un día vacío cuando la carga falla.
          </p>
          <Button className="mt-4 gap-2" onClick={() => void refetchTasks?.()}>
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  // Only show full-screen loading on the very first load, not during refetches
  const isInitialLoad = !hasLoadedOnce.current && isLoading && (!tasks || tasks.length === 0);
  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <LoadingSpinner size="lg" text={`Cargando calendario${activeSede?.nombre ? ` de ${activeSede.nombre}` : ''}...`} />
      </div>
    );
  }

  // Show subtle loading indicator during refetches (non-blocking)
  const isRefetching = hasLoadedOnce.current && isLoading;
  const lastUpdate = formatUpdatedAt(tasksUpdatedAt);

  // Previous data is still shown, but the person must know it may be stale.
  const staleDataBanner = isTasksError && tasks.length > 0 ? (
    <div className="flex items-center justify-between gap-3 rounded-md border border-danger/40 bg-paper px-3 py-2 text-sm" role="alert">
      <span className="flex items-center gap-2 text-danger">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        No se han podido actualizar las tareas{lastUpdate ? `; datos de las ${lastUpdate}` : ''}.
      </span>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void refetchTasks?.()}>
        <RefreshCw className="h-3.5 w-3.5" />
        Reintentar
      </Button>
    </div>
  ) : null;

  const newTaskAction = permissions.canCreate ? handleNewTask : undefined;
  const newBatchTaskAction = permissions.canCreate ? handleNewBatchTask : undefined;

  // Mobile views - render specific mobile interfaces
  if (isMobile) {
    // Mobile manager/admin view: consultation agenda (no new reparto gestures).

    return (
      <CalendarActionsProvider value={pageActions}>
        <div className="h-screen flex flex-col bg-background text-foreground transition-colors duration-300 relative overflow-hidden">
          {/* Subtle loading indicator during refetches */}
          {isRefetching && (
            <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-md">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Actualizando...</span>
            </div>
          )}
          {staleDataBanner && <div className="px-3 pt-3">{staleDataBanner}</div>}
          <ManagerMobileAgendaCalendar
            currentDate={currentDate}
            tasks={tasks}
            cleaners={cleaners}
            onNavigateDate={navigateDate}
            onGoToToday={goToToday}
            onSelectDate={setCurrentDate}
            onTaskClick={handleTaskClick}
            onNewTask={newTaskAction}
            onNewBatchTask={newBatchTaskAction}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            clientOptions={clientFilterOptions}
            selectedClientIds={selectedClientFilters}
            onClientFilterChange={setSelectedClientFilters}
            clientNameById={clientNameById}
          />
        </div>

        {confirmDialog}

        {/* Modals for mobile manager view */}
        <CalendarModalsWithSuspense
          isCreateModalOpen={isCreateModalOpen}
          setIsCreateModalOpen={setIsCreateModalOpen}
          isBatchCreateModalOpen={isBatchCreateModalOpen}
          setIsBatchCreateModalOpen={setIsBatchCreateModalOpen}
          selectedTask={selectedTask}
          isTaskModalOpen={isTaskModalOpen}
          setIsTaskModalOpen={setIsTaskModalOpen}
          currentDate={currentDate}
          onCreateTask={handleCreateTask}
          onBatchCreateTasks={handleBatchCreateTasks}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          onUnassignTask={handleUnassignTask}
          permissions={permissions}
        />
      </CalendarActionsProvider>
    );
  }

  // Cleaners never reach this component: src/pages/Calendar.tsx renders
  // CleanerCalendarScreen for them.

  // Desktop manager/admin view

  return (
    <CalendarActionsProvider value={pageActions}>
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
          onNewTask={newTaskAction}
          onNewBatchTask={newBatchTaskAction}
          onSelectDate={setCurrentDate}
          zoom={zoom}
          onZoomChange={setZoom}
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

        {pendingCalendarMove && <div role="status" className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">{pendingCalendarMove}</div>}
        {staleDataBanner}

        {/* Panel desplegable de trabajadoras no disponibles */}
        <UnavailableWorkersPanel
          cleaners={cleaners}
          currentDate={rangeStartDate}
          currentView={currentView}
          tasks={tasks}
        />

        {/* Calendar Container - takes available space */}
        <div className="flex-1 flex flex-col min-h-0">
          <CalendarContainer
            tasks={filteredTasks}
            cleaners={filteredCleaners}
            currentDate={currentDate}
            currentView={currentView}
            timeSlots={timeSlots}
            availability={availability}
            headerScrollRef={headerScrollRef}
            bodyScrollRef={bodyScrollRef}
            isCreateModalOpen={isCreateModalOpen}
            setIsCreateModalOpen={setIsCreateModalOpen}
            isBatchCreateModalOpen={isBatchCreateModalOpen}
            setIsBatchCreateModalOpen={setIsBatchCreateModalOpen}
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
            handleUpdateTask={handleUpdateTask}
            handleDeleteTask={handleDeleteTask}
            handleUnassignTask={handleUnassignTask}
            handleRemoveCleanerFromTask={handleRemoveCleanerFromTask}
            onNavigateDate={navigateDate}
            onSelectDay={handleSelectDay}
            onConfirm={confirm}
            permissions={permissions}
            validateScheduleChange={validateScheduleChange}
            zoom={zoom}
            unassignedNote={unassignedNote}
          />
        </div>

        {confirmDialog}

        {/* Footer-resumen con totales y leyenda de clientes */}
        <div className="flex-shrink-0">
          <CalendarFooterSummary
            tasks={summaryTasks}
            cleaners={filteredCleaners}
            periodLabel={getFooterPeriodLabel(currentDate, isMultiDay)}
          />
        </div>
      </div>
    </div>
    </CalendarActionsProvider>
  );
};

export default CleaningCalendar;
