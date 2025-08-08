import React, { useState, useMemo } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DashboardSidebar } from './DashboardSidebar';
import { MobileDashboardHeader } from './MobileDashboardHeader';
import { DashboardStatsCards } from './components/DashboardStatsCards';
import { TodayTasksSection } from './components/TodayTasksSection';
import { DashboardMetricsCards } from './components/DashboardMetricsCards';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { BatchCreateTaskModal } from '@/components/modals/BatchCreateTaskModal';
import { TaskDetailsModal } from '@/components/modals/TaskDetailsModal';
import { useOptimizedTasks } from '@/hooks/useOptimizedTasks';
import { useOptimizedCleaningReports } from '@/hooks/useOptimizedCleaningReports';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useTasksPageActions } from '@/hooks/tasks/useTasksPageActions';
import { HostawayIntegrationWidget } from '@/components/hostaway/HostawayIntegrationWidget';
import { format, startOfMonth, endOfMonth, isAfter, isBefore, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';

export const ManagerDashboard = () => {
  const [selectedDate] = useState(new Date());
  const [currentTaskPage, setCurrentTaskPage] = useState(0);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
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

  // Funciones de navegación
  const goToPreviousPage = () => {
    setCurrentTaskPage(prev => Math.max(0, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentTaskPage(prev => Math.min(totalTaskPages - 1, prev + 1));
  };

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

  // Función para manejar el clic en una tarea
  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setIsTaskDetailsOpen(true);
  };

  // Función para actualizar una tarea
  const handleUpdateTask = async (taskId, updates) => {
    // Esta función será implementada por el hook de tareas
    console.log('Updating task:', taskId, updates);
    // Por ahora, simplemente cerramos el modal
    setIsTaskDetailsOpen(false);
  };

  // Función para eliminar una tarea
  const handleDeleteTask = async (taskId) => {
    // Esta función será implementada por el hook de tareas
    console.log('Deleting task:', taskId);
    // Por ahora, simplemente cerramos el modal
    setIsTaskDetailsOpen(false);
  };


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
              {/* Hostaway Integration Widget - Solo si tiene permisos */}
              {canAccessModule('hostaway') && (
                <div className="mb-6">
                  <HostawayIntegrationWidget />
                </div>
              )}

              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Dashboard de Gestión
                </h1>
                <p className="text-gray-600">
                  {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              </div>

              {/* Main Metrics Row */}
              <DashboardStatsCards 
                monthlyMetrics={monthlyMetrics}
                onOpenCreateModal={handleOpenCreateModal}
                onOpenBatchModal={handleOpenBatchModal}
              />

              {/* Central Section - Today's Tasks */}
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

              {/* Bottom Row */}
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
      
      {/* Modales */}
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
    </SidebarProvider>
  );
};