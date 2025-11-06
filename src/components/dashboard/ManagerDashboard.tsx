import React, { useState, useMemo, useCallback, Suspense, lazy } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DashboardSidebar } from './DashboardSidebar';
import { MobileDashboardHeader } from './MobileDashboardHeader';
import { SedeSelector } from '@/components/sede/SedeSelector';
import { useOptimizedTasks } from '@/hooks/useOptimizedTasks';
import { useOptimizedCleaningReports } from '@/hooks/useOptimizedCleaningReports';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useTasksPageActions } from '@/hooks/tasks/useTasksPageActions';
import { format, startOfMonth, endOfMonth, isAfter, isBefore, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { BatchCreateTaskModal } from '@/components/modals/BatchCreateTaskModal';
import { TaskDetailsModal } from '@/components/modals/TaskDetailsModal';
import { CreateExtraordinaryServiceModal } from '@/components/modals/CreateExtraordinaryServiceModal';

// Lazy load components for better performance
const DashboardStatsCards = lazy(() => import('./components/DashboardStatsCards').then(module => ({ default: module.DashboardStatsCards })));
const TodayTasksSection = lazy(() => import('./components/TodayTasksSection').then(module => ({ default: module.TodayTasksSection })));
import DashboardMetricsCards from './components/DashboardMetricsCards';
const HostawayIntegrationWidget = lazy(() => import('@/components/hostaway/HostawayIntegrationWidget').then(module => ({ default: module.HostawayIntegrationWidget })));

// Loading component for Suspense
const ComponentLoader = () => (
  <div className="flex items-center justify-center p-8">
    <LoadingSpinner size="sm" />
  </div>
);

export const ManagerDashboard = () => {
  const [selectedDate] = useState(new Date());
  const [currentTaskPage, setCurrentTaskPage] = useState(0);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [isExtraordinaryServiceModalOpen, setIsExtraordinaryServiceModalOpen] = useState(false);
  const { canAccessModule } = useRolePermissions();
  const isMobile = useIsMobile();
  
  // Hook para manejar las acciones de tareas con la fecha correcta
  const {
    isCreateModalOpen,
    setIsCreateModalOpen,
    isBatchCreateModalOpen,
    setIsBatchCreateModalOpen,
    handleCreateTask,
    handleBatchCreateTasks,
    handleOpenCreateModal,
    handleOpenBatchModal
  } = useTasksPageActions(selectedDate);
  
  // Obtener tareas del mes actual
  const { tasks } = useOptimizedTasks({
    currentDate: selectedDate,
    currentView: 'day'
  });

  // Obtener reportes para incidencias
  const { dashboardMetrics, recentReports } = useOptimizedCleaningReports({
    dateRange: 'month',
    cleaner: '',
    status: '',
    property: '',
    hasIncidents: 'yes'
  });

  // Calcular métricas del mes actual vs anterior
  const monthlyMetrics = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const currentMonthTasks = tasks.filter(task => {
      const taskDate = new Date(task.date);
      return isAfter(taskDate, currentMonthStart) && isBefore(taskDate, currentMonthEnd);
    });

    const lastMonthTasks = tasks.filter(task => {
      const taskDate = new Date(task.date);
      return isAfter(taskDate, lastMonthStart) && isBefore(taskDate, lastMonthEnd);
    });

    // Tareas hasta la fecha actual del mes pasado
    const dayOfMonth = now.getDate();
    const lastMonthSameDate = new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth(), dayOfMonth);
    const lastMonthSameDateTasks = tasks.filter(task => {
      const taskDate = new Date(task.date);
      return isAfter(taskDate, lastMonthStart) && isBefore(taskDate, lastMonthSameDate);
    });

    const percentageChange = lastMonthSameDateTasks.length > 0 
      ? ((currentMonthTasks.length - lastMonthSameDateTasks.length) / lastMonthSameDateTasks.length) * 100
      : 0;

    return {
      currentMonth: currentMonthTasks.length,
      lastMonth: lastMonthSameDateTasks.length,
      percentageChange: Math.round(percentageChange),
      isPositive: percentageChange >= 0
    };
  }, [tasks]);

  // Tareas del día
  const todayTasks = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return tasks.filter(task => task.date === today);
  }, [tasks]);

  // Paginación de tareas del día
  const TASKS_PER_PAGE = 6;
  const totalTaskPages = Math.ceil(todayTasks.length / TASKS_PER_PAGE);
  const paginatedTodayTasks = useMemo(() => {
    const startIndex = currentTaskPage * TASKS_PER_PAGE;
    return todayTasks.slice(startIndex, startIndex + TASKS_PER_PAGE);
  }, [todayTasks, currentTaskPage]);

  // Optimized navigation functions with useCallback
  const goToPreviousPage = useCallback(() => {
    setCurrentTaskPage(prev => Math.max(0, prev - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentTaskPage(prev => Math.min(totalTaskPages - 1, prev + 1));
  }, [totalTaskPages]);

  // Reset page when tasks change
  useMemo(() => {
    if (currentTaskPage >= totalTaskPages && totalTaskPages > 0) {
      setCurrentTaskPage(0);
    }
  }, [totalTaskPages, currentTaskPage]);

  // Tareas sin asignar
  const unassignedTasks = useMemo(() => {
    return tasks.filter(task => !task.cleanerId && !task.cleaner);
  }, [tasks]);

  // Incidencias pendientes
  const pendingIncidents = useMemo(() => {
    return recentReports.filter(report => 
      report.issues_found && 
      report.issues_found.length > 0 && 
      report.overall_status !== 'completed'
    ).length;
  }, [recentReports]);

  // Optimized event handlers with useCallback
  const handleTaskClick = useCallback((task) => {
    setSelectedTask(task);
    setIsTaskDetailsOpen(true);
  }, []);

  const handleUpdateTask = useCallback(async (taskId, updates) => {
    // Esta función será implementada por el hook de tareas
    console.log('Updating task:', taskId, updates);
    // Por ahora, simplemente cerramos el modal
    setIsTaskDetailsOpen(false);
  }, []);

  const handleDeleteTask = useCallback(async (taskId) => {
    // Esta función será implementada por el hook de tareas
    console.log('Deleting task:', taskId);
    // Por ahora, simplemente cerramos el modal
    setIsTaskDetailsOpen(false);
  }, []);

  const handleCreateExtraordinaryService = useCallback(async (serviceData) => {
    try {
      console.log('Creating extraordinary service:', serviceData);
      // Aquí se implementará la lógica para crear el servicio extraordinario
      // Por ahora, mostramos un mensaje de éxito
      setIsExtraordinaryServiceModalOpen(false);
    } catch (error) {
      console.error('Error creating extraordinary service:', error);
    }
  }, []);

  const handleOpenExtraordinaryServiceModal = useCallback(() => {
    setIsExtraordinaryServiceModalOpen(true);
  }, []);


  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-gray-50">
        {/* Header móvil */}
        <MobileDashboardHeader />
        
        <div className="flex min-h-screen w-full">
          {/* Sidebar desktop - oculto en móvil */}
          {!isMobile && (
            <DashboardSidebar />
          )}
          
          <main className="flex-1 overflow-auto lg:pt-0 pt-0">
          <div className="p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Performance notice for large datasets */}
              {(todayTasks.length > 20 || tasks.length > 100) && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    <span className="text-sm text-blue-700">
                      ⚡ Optimizaciones de rendimiento activas - {todayTasks.length} tareas hoy, {tasks.length} tareas totales
                    </span>
                  </div>
                </div>
              )}

              {/* Hostaway Integration Widget - Lazy loaded */}
              {canAccessModule('hostaway') && (
                <div className="mb-6">
                  <Suspense fallback={<ComponentLoader />}>
                    <HostawayIntegrationWidget />
                  </Suspense>
                </div>
              )}

              {/* Header */}
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Dashboard de Gestión
                  </h1>
                  <p className="text-gray-600">
                    {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                </div>
                {/* Selector de sede en el dashboard */}
                <div className="flex items-center gap-4">
                  <SedeSelector />
                </div>
              </div>

              {/* Main Metrics Row - Lazy loaded */}
              <Suspense fallback={<ComponentLoader />}>
                <DashboardStatsCards 
                  monthlyMetrics={monthlyMetrics}
                  onOpenCreateModal={handleOpenCreateModal}
                  onOpenBatchModal={handleOpenBatchModal}
                  onOpenExtraordinaryServiceModal={handleOpenExtraordinaryServiceModal}
                />
              </Suspense>

              {/* Central Section - Today's Tasks - Lazy loaded */}
              <Suspense fallback={<ComponentLoader />}>
                <TodayTasksSection 
                  todayTasks={todayTasks}
                  paginatedTodayTasks={paginatedTodayTasks}
                  currentTaskPage={currentTaskPage}
                  totalTaskPages={totalTaskPages}
                  TASKS_PER_PAGE={TASKS_PER_PAGE}
                  onTaskClick={handleTaskClick}
                  onPreviousPage={goToPreviousPage}
                  onNextPage={goToNextPage}
                />
              </Suspense>

              {/* Bottom Row - Direct import */}
              <DashboardMetricsCards 
                pendingIncidents={pendingIncidents}
                unassignedTasksCount={unassignedTasks.length}
                todayTasks={todayTasks}
              />
            </div>
          </div>
          </main>
        </div>
      </div>
      
      {/* Modales - Direct imports */}
      <CreateTaskModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreateTask={handleCreateTask}
      />
      
      <BatchCreateTaskModal
        open={isBatchCreateModalOpen}
        onOpenChange={setIsBatchCreateModalOpen}
        onCreateTasks={handleBatchCreateTasks}
      />
      
      {/* Modal de detalles de tarea */}
      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          open={isTaskDetailsOpen}
          onOpenChange={setIsTaskDetailsOpen}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
        />
      )}

      {/* Modal de servicio extraordinario */}
      <CreateExtraordinaryServiceModal
        open={isExtraordinaryServiceModalOpen}
        onOpenChange={setIsExtraordinaryServiceModalOpen}
        onCreateService={handleCreateExtraordinaryService}
        currentDate={selectedDate}
      />
    </SidebarProvider>
  );
};