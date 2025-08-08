import React, { useState, useMemo } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DashboardSidebar } from './DashboardSidebar';
import { MobileDashboardHeader } from './MobileDashboardHeader';
import { DashboardStatsCards } from './components/DashboardStatsCards';
import { TodayTasksSection } from './components/TodayTasksSection';
import { DashboardMetricsCards } from './components/DashboardMetricsCards';
import { Button } from '@/components/ui/button';
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
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-white">
        {/* Header móvil */}
        <MobileDashboardHeader />
        
        <div className="flex min-h-screen w-full">
          {/* Sidebar desktop - oculto en móvil */}
          {!isMobile && (
            <DashboardSidebar />
          )}
          
          <main className="flex-1 overflow-auto lg:pt-0 pt-0">
            <div className="p-6">
              <div className="max-w-7xl mx-auto space-y-8">
                {/* Hero */}
                <div className="rounded-2xl p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h1 className="text-3xl font-bold mb-1">Panel de Gestión</h1>
                      <p className="text-white/80">{format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleOpenCreateModal} className="bg-white text-blue-700 hover:bg-white/90">
                        + Nueva tarea
                      </Button>
                      <Button onClick={handleOpenBatchModal} variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                        Carga múltiple
                      </Button>
                      <Button onClick={() => window.location.assign('/calendar')} variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                        Ver calendario
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Hostaway Integration Widget - Solo si tiene permisos */}
                {canAccessModule('hostaway') && (
                  <div className="mb-2">
                    <HostawayIntegrationWidget />
                  </div>
                )}

                {/* KPIs y acciones */}
                <DashboardStatsCards 
                  monthlyMetrics={monthlyMetrics}
                  onOpenCreateModal={handleOpenCreateModal}
                  onOpenBatchModal={handleOpenBatchModal}
                  todayCount={todayTasks.length}
                  unassignedCount={unassignedTasks.length}
                  pendingIncidents={pendingIncidents}
                />

                {/* Tareas de hoy */}
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

                {/* Inferior: métricas + accesos rápidos + actividad */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2">
                    <DashboardMetricsCards 
                      pendingIncidents={pendingIncidents}
                      unassignedTasksCount={unassignedTasks.length}
                      todayTasks={todayTasks}
                    />
                  </div>

                  {/* Accesos rápidos y actividad reciente */}
                  <div className="space-y-6">
                    {/* Accesos rápidos */}
                    <div className="bg-white rounded-xl shadow-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-800 mb-3">Accesos rápidos</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="justify-start" onClick={() => window.location.assign('/tasks')}>Tareas</Button>
                        <Button variant="outline" className="justify-start" onClick={() => window.location.assign('/workers')}>Trabajadores</Button>
                        <Button variant="outline" className="justify-start" onClick={() => window.location.assign('/properties')}>Propiedades</Button>
                        <Button variant="outline" className="justify-start" onClick={() => window.location.assign('/cleaning-reports')}>Reportes</Button>
                      </div>
                    </div>

                    {/* Actividad reciente (reportes con incidencias) */}
                    <div className="bg-white rounded-xl shadow-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-800 mb-3">Actividad reciente</h3>
                      <ul className="divide-y divide-gray-100">
                        {recentReports.slice(0,5).map((r, idx) => (
                          <li key={idx} className="py-3 flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">Reporte #{r.id.slice(0,8)}</p>
                              <p className="text-xs text-gray-500 truncate">{r.notes || 'Sin notas'}</p>
                            </div>
                            <span className="text-xs px-2 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                              {r.overall_status}
                            </span>
                          </li>
                        ))}
                        {recentReports.length === 0 && (
                          <li className="py-3 text-sm text-gray-500">Sin actividad reciente</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
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