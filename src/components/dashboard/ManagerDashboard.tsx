import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DashboardSidebar } from './DashboardSidebar';
import { MobileDashboardHeader } from './MobileDashboardHeader';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { BatchCreateTaskModal } from '@/components/modals/BatchCreateTaskModal';
import { TaskDetailsModal } from '@/components/modals/TaskDetailsModal';
import { 
  Plus, 
  Calendar, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Users,
  Clock,
  CheckCircle2,
  PlusSquare,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
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
  
  // Hook para manejar las acciones de tareas
  const {
    isCreateModalOpen,
    setIsCreateModalOpen,
    isBatchCreateModalOpen,
    setIsBatchCreateModalOpen,
    handleCreateTask,
    handleBatchCreateTasks,
    handleOpenCreateModal,
    handleOpenBatchModal
  } = useTasksPageActions();
  
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
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                {/* Limpiezas del mes */}
                <Card className="lg:col-span-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl font-semibold flex items-center gap-2">
                      <CheckCircle2 className="h-6 w-6" />
                      Limpiezas de {format(new Date(), 'MMMM', { locale: es })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-4xl font-bold mb-2">{monthlyMetrics.currentMonth}</div>
                        <div className="flex items-center gap-2 text-blue-100">
                          {monthlyMetrics.isPositive ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          <span className="text-sm">
                            {monthlyMetrics.isPositive ? '+' : ''}{monthlyMetrics.percentageChange}% vs mes pasado
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-blue-100 mb-1">Mes anterior (misma fecha)</div>
                        <div className="text-2xl font-semibold">{monthlyMetrics.lastMonth}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button 
                    onClick={handleOpenCreateModal}
                    className="h-full bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white border-0 shadow-lg flex flex-col items-center justify-center py-8"
                  >
                    <Plus className="h-8 w-8 mb-2" />
                    <span className="text-lg font-semibold">Añadir Tarea</span>
                  </Button>
                  <Button 
                    onClick={handleOpenBatchModal}
                    className="h-full bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white border-0 shadow-lg flex flex-col items-center justify-center py-8"
                  >
                    <PlusSquare className="h-8 w-8 mb-2" />
                    <span className="text-lg font-semibold">Tareas Múltiples</span>
                  </Button>
                </div>
              </div>

              {/* Central Section - Today's Tasks */}
              <Card className="bg-white shadow-lg border-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-xl font-semibold text-gray-800">
                      <Calendar className="h-6 w-6 text-blue-600" />
                      Tareas de Hoy
                    </CardTitle>
                    
                    {/* Navegación y paginación - Solo mostrar si hay más de 6 tareas */}
                    {todayTasks.length > TASKS_PER_PAGE && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          Página {currentTaskPage + 1} de {totalTaskPages}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToPreviousPage}
                            disabled={currentTaskPage === 0}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToNextPage}
                            disabled={currentTaskPage >= totalTaskPages - 1}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {todayTasks.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No hay tareas programadas para hoy</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {paginatedTodayTasks.map((task) => (
                        <div 
                          key={task.id} 
                          className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border cursor-pointer transition-all hover:shadow-md hover:scale-105 hover:bg-gradient-to-br hover:from-blue-50 hover:to-blue-100"
                          onClick={() => handleTaskClick(task)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-gray-900 truncate">{task.property}</h4>
                            <Badge 
                              variant={task.status === 'completed' ? 'default' : task.status === 'in-progress' ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {task.status === 'completed' ? 'Completado' : 
                               task.status === 'in-progress' ? 'En Progreso' : 'Pendiente'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{task.address}</p>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">{task.startTime} - {task.endTime}</span>
                            {task.cleaner && (
                              <div className="flex items-center gap-1 text-blue-600">
                                <Users className="h-3 w-3" />
                                <span className="text-xs">{task.cleaner}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Indicador de total de tareas si hay paginación */}
                  {todayTasks.length > TASKS_PER_PAGE && (
                    <div className="text-center mt-4">
                      <p className="text-sm text-gray-500">
                        Mostrando {paginatedTodayTasks.length} de {todayTasks.length} tareas del día
                      </p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => window.location.href = '/calendar'}>
                        Ver todas en el calendario
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bottom Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Incidencias por resolver */}
                <Card className="bg-white shadow-lg border-l-4 border-orange-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      Incidencias por Resolver
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-orange-600 mb-2">{pendingIncidents}</div>
                      <p className="text-sm text-gray-600">Reportes con incidencias pendientes</p>
                      {pendingIncidents > 0 && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-3 border-orange-300 text-orange-700 hover:bg-orange-50"
                          onClick={() => window.location.href = '/cleaning-reports'}
                        >
                          Ver Reportes
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Tareas sin asignar */}
                <Card className="bg-white shadow-lg border-l-4 border-yellow-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                      <Clock className="h-5 w-5 text-yellow-500" />
                      Tareas Sin Asignar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-600 mb-2">{unassignedTasks.length}</div>
                      <p className="text-sm text-gray-600">Requieren asignación de personal</p>
                      {unassignedTasks.length > 0 && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-3 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                          onClick={() => window.location.href = '/tasks'}
                        >
                          Asignar Tareas
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Progreso General */}
                <Card className="bg-white shadow-lg border-l-4 border-green-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      Progreso del Día
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Tareas Completadas</span>
                        <span className="text-sm font-medium text-gray-800">
                          {todayTasks.filter(t => t.status === 'completed').length}/{todayTasks.length}
                        </span>
                      </div>
                      <Progress 
                        value={todayTasks.length > 0 ? (todayTasks.filter(t => t.status === 'completed').length / todayTasks.length) * 100 : 0}
                        className="h-2"
                      />
                      <p className="text-xs text-gray-500 text-center">
                        {todayTasks.length > 0 
                          ? `${Math.round((todayTasks.filter(t => t.status === 'completed').length / todayTasks.length) * 100)}% completado`
                          : 'Sin tareas para hoy'
                        }
                      </p>
                    </div>
                  </CardContent>
                </Card>
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