import React, { useState, useMemo, useCallback, Suspense, lazy } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DashboardSidebar } from './DashboardSidebar';
import { MobileDashboardHeader } from './MobileDashboardHeader';
import { MobileDashboardSidebar } from './MobileDashboardSidebar';
import { useOptimizedTasks } from '@/hooks/useOptimizedTasks';
import { useOptimizedCleaningReports } from '@/hooks/useOptimizedCleaningReports';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calendar, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy load heavy components
const DashboardStatsCards = lazy(() => import('./components/DashboardStatsCards').then(module => ({ default: module.DashboardStatsCards })));
const TodayTasksSection = lazy(() => import('./components/TodayTasksSection').then(module => ({ default: module.TodayTasksSection })));
const DashboardMetricsCards = lazy(() => import('./components/DashboardMetricsCards').then(module => ({ default: module.DashboardMetricsCards })));
const HostawayIntegrationWidget = lazy(() => import('@/components/hostaway/HostawayIntegrationWidget').then(module => ({ default: module.HostawayIntegrationWidget })));
const CreateTaskModal = lazy(() => import('@/components/modals/CreateTaskModal').then(module => ({ default: module.CreateTaskModal })));
const BatchCreateTaskModal = lazy(() => import('@/components/modals/BatchCreateTaskModal').then(module => ({ default: module.BatchCreateTaskModal })));
const TaskDetailsModal = lazy(() => import('@/components/modals/TaskDetailsModal').then(module => ({ default: module.TaskDetailsModal })));

// Loading component for Suspense
const ComponentLoader = ({ text }: { text: string }) => (
  <div className="flex items-center justify-center p-8">
    <LoadingSpinner size="sm" text={text} />
  </div>
);

export const OptimizedManagerDashboard = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentTaskPage, setCurrentTaskPage] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchCreateModal, setShowBatchCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const { canAccessModule } = useRolePermissions();
  const isMobile = useIsMobile();

  // Optimized data fetching with selective loading
  const { 
    tasks, 
    isLoading: isLoadingTasks 
  } = useOptimizedTasks({
    currentDate: selectedDate,
    currentView: 'week',
    enabled: true
  });

  const { 
    reports: filteredReports, 
    dashboardMetrics, 
    isLoading: isLoadingReports 
  } = useOptimizedCleaningReports({
    dateRange: 'thisMonth',
    cleaner: 'all',
    status: 'all',
    property: 'all',
    hasIncidents: 'all'
  });

  // Memoized calculations to prevent unnecessary re-renders
  const todayTasks = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return tasks.filter(task => task.date === today);
  }, [tasks]);

  const monthlyMetrics = useMemo(() => {
    const currentMonth = new Date();
    const previousMonth = new Date(currentMonth);
    previousMonth.setMonth(currentMonth.getMonth() - 1);

    const currentMonthTasks = tasks.filter(task => {
      const taskDate = new Date(task.date);
      return taskDate.getMonth() === currentMonth.getMonth() && 
             taskDate.getFullYear() === currentMonth.getFullYear();
    });

    const previousMonthTasks = tasks.filter(task => {
      const taskDate = new Date(task.date);
      return taskDate.getMonth() === previousMonth.getMonth() && 
             taskDate.getFullYear() === previousMonth.getFullYear();
    });

    const currentCompleted = currentMonthTasks.filter(task => task.status === 'completed').length;
    const previousCompleted = previousMonthTasks.filter(task => task.status === 'completed').length;

    return {
      currentMonth: currentCompleted,
      previousMonth: previousCompleted,
      change: previousCompleted > 0 ? ((currentCompleted - previousCompleted) / previousCompleted) * 100 : 0
    };
  }, [tasks]);

  const pendingIncidents = useMemo(() => {
    return filteredReports.filter(report => 
      report.issues_found && report.issues_found.length > 0
    ).length;
  }, [filteredReports]);

  // Pagination for today's tasks
  const tasksPerPage = 6;
  const totalTaskPages = Math.ceil(todayTasks.length / tasksPerPage);
  const paginatedTasks = useMemo(() => {
    const startIndex = currentTaskPage * tasksPerPage;
    return todayTasks.slice(startIndex, startIndex + tasksPerPage);
  }, [todayTasks, currentTaskPage, tasksPerPage]);

  // Optimized event handlers
  const goToPreviousPage = useCallback(() => {
    setCurrentTaskPage(prev => Math.max(0, prev - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentTaskPage(prev => Math.min(totalTaskPages - 1, prev + 1));
  }, [totalTaskPages]);

  // Reset page when total pages change
  useMemo(() => {
    if (currentTaskPage >= totalTaskPages && totalTaskPages > 0) {
      setCurrentTaskPage(0);
    }
  }, [totalTaskPages, currentTaskPage]);

  // Optimized task handlers
  const handleTaskClick = useCallback((task) => {
    setSelectedTask(task);
    setShowTaskDetailsModal(true);
  }, []);

  const handleUpdateTask = useCallback((taskId, updates) => {
    console.log('Update task:', taskId, updates);
    // TODO: Implement task update logic
  }, []);

  const handleDeleteTask = useCallback((taskId) => {
    console.log('Delete task:', taskId);
    // TODO: Implement task deletion logic
  }, []);

  // Loading state
  if (isLoadingTasks && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Cargando dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Mobile Header */}
      {isMobile && (
        <div className="bg-white shadow-sm border-b p-4">
          <Button 
            variant="ghost" 
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2"
          >
            <span>☰ Menú</span>
          </Button>
        </div>
      )}

      <div className="flex">
        {/* Sidebar - Hidden on mobile */}
        {!isMobile && (
          <div className="w-64 min-h-screen">
            <DashboardSidebar />
          </div>
        )}

        {/* Mobile Sidebar */}
        {isMobile && isMobileSidebarOpen && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setIsMobileSidebarOpen(false)}>
            <div className="w-64 h-full bg-white shadow-lg">
              <DashboardSidebar />
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 p-4 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Dashboard de Gestión
                </h1>
                <p className="text-muted-foreground mt-1">
                  {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={() => setShowCreateModal(true)}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Tarea
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowBatchCreateModal(true)}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Crear Múltiples
                </Button>
              </div>
            </div>

            {/* Hostaway Integration Widget - Lazy loaded */}
            {canAccessModule('hostaway') && (
              <Suspense fallback={<ComponentLoader text="Cargando integración..." />}>
                <HostawayIntegrationWidget />
              </Suspense>
            )}

            {/* Stats Cards - Lazy loaded */}
            <Suspense fallback={<ComponentLoader text="Cargando estadísticas..." />}>
              <DashboardStatsCards 
                tasks={todayTasks}
                monthlyMetrics={monthlyMetrics}
                pendingIncidents={pendingIncidents}
              />
            </Suspense>

            {/* Today's Tasks Section - Lazy loaded */}
            <Suspense fallback={<ComponentLoader text="Cargando tareas..." />}>
              <TodayTasksSection
                tasks={paginatedTasks}
                currentPage={currentTaskPage}
                totalPages={totalTaskPages}
                onTaskClick={handleTaskClick}
                onPreviousPage={goToPreviousPage}
                onNextPage={goToNextPage}
                isLoading={isLoadingTasks}
              />
            </Suspense>

            {/* Metrics Cards - Lazy loaded */}
            <Suspense fallback={<ComponentLoader text="Cargando métricas..." />}>
              <DashboardMetricsCards 
                dashboardMetrics={dashboardMetrics}
                isLoading={isLoadingReports}
              />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Modals - Lazy loaded */}
      <Suspense fallback={null}>
        {showCreateModal && (
          <CreateTaskModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onTaskCreated={() => setShowCreateModal(false)}
            currentDate={selectedDate}
          />
        )}

        {showBatchCreateModal && (
          <BatchCreateTaskModal
            isOpen={showBatchCreateModal}
            onClose={() => setShowBatchCreateModal(false)}
            onTasksCreated={() => setShowBatchCreateModal(false)}
          />
        )}

        {showTaskDetailsModal && selectedTask && (
          <TaskDetailsModal
            task={selectedTask}
            isOpen={showTaskDetailsModal}
            onClose={() => {
              setShowTaskDetailsModal(false);
              setSelectedTask(null);
            }}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
          />
        )}
      </Suspense>
    </div>
  );
};