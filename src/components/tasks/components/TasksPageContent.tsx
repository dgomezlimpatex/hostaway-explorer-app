import React from 'react';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TasksList } from '../TasksList';
import { TaskFilters } from '../TaskFilters';
import { TaskStatsCard } from './TaskStatsCard';
import { CalendarIntegrationWidget } from './CalendarIntegrationWidget';
import { RecurringTasksWidget } from './RecurringTasksWidget';
import { TasksPagination } from './TasksPagination';
import { Task } from '@/types/calendar';
import { useDeviceType } from '@/hooks/use-mobile';

interface TasksPageContentProps {
  showPastTasks: boolean;
  tasks: Task[];
  sortedTasks: Task[];
  paginatedTasks: Task[];
  filters: {
    status: string;
    cleaner: string;
    dateRange: string;
    cliente: string;
    propiedad: string;
  };
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onFiltersChange: (filters: TasksPageContentProps['filters']) => void;
  onShowHistory: (task: Task) => void;
  onCreateReport: (task: Task) => void;
  onOpenGroupedReport?: (task: Task) => void;
  onAssignMultipleCleaners?: (task: Task) => void;
  onPageChange: (page: number) => void;
  onRefetch: () => void;
}

export const TasksPageContent = ({
  showPastTasks,
  tasks,
  sortedTasks,
  paginatedTasks,
  filters,
  isLoading,
  currentPage,
  totalPages,
  onFiltersChange,
  onShowHistory,
  onCreateReport,
  onOpenGroupedReport,
  onAssignMultipleCleaners,
  onPageChange,
  onRefetch,
}: TasksPageContentProps) => {
  const { isCleaner } = useRolePermissions();
  const { isMobile } = useDeviceType();
  const cleanerView = isCleaner();
  const searchFilteredTasks = sortedTasks;

  // Mobile-first layout: Task list comes first
  if (isMobile) {
    return (
      <div className="container mx-auto p-3 space-y-4">
        {/* Estadísticas - Solo mostrar para tareas actuales y no para limpiadoras */}
        {!showPastTasks && !cleanerView && <TaskStatsCard tasks={searchFilteredTasks} />}

        {/* Para limpiadoras: mostrar tareas separadas por secciones */}
        {cleanerView && !showPastTasks ? (
          <div className="space-y-4">
            {/* Tareas de hoy */}
            {(() => {
              const today = new Date().toISOString().split('T')[0];
              const todayTasks = paginatedTasks.filter(task => task.date === today);
              
              return todayTasks.length > 0 ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-primary font-semibold">
                      📅 TAREAS PARA HOY ({todayTasks.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <TasksList 
                      tasks={todayTasks} 
                      filters={filters} 
                      isLoading={isLoading} 
                      onShowHistory={onShowHistory}
                      onCreateReport={onCreateReport}
                      onOpenGroupedReport={onOpenGroupedReport}
                      onAssignMultipleCleaners={onAssignMultipleCleaners}
                      onRefetch={onRefetch}
                    />
                  </CardContent>
                </Card>
              ) : null;
            })()}

            {/* Próximas tareas */}
            {(() => {
              const today = new Date().toISOString().split('T')[0];
              const upcomingTasks = paginatedTasks
                .filter(task => task.date > today)
                .sort((a, b) => {
                  // Primero por fecha
                  const dateComparison = a.date.localeCompare(b.date);
                  if (dateComparison !== 0) return dateComparison;
                  
                  // Si la fecha es la misma, por hora de inicio
                  return a.startTime.localeCompare(b.startTime);
                });
              
              return upcomingTasks.length > 0 ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-muted-foreground font-semibold">
                      ⏰ PRÓXIMAS TAREAS ({upcomingTasks.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <TasksList 
                      tasks={upcomingTasks} 
                      filters={filters} 
                      isLoading={isLoading} 
                      onShowHistory={onShowHistory}
                      onCreateReport={onCreateReport}
                      onOpenGroupedReport={onOpenGroupedReport}
                      onAssignMultipleCleaners={onAssignMultipleCleaners}
                      onRefetch={onRefetch}
                    />
                  </CardContent>
                </Card>
              ) : null;
            })()}
            
            {totalPages > 1 && (
              <TasksPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={onPageChange}
              />
            )}
          </div>
        ) : (
          // Vista normal para no-limpiadoras o historial
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {cleanerView
                    ? 'Mis Tareas'
                    : (showPastTasks ? 'Historial de Tareas' : 'Lista de Tareas')
                  } {!cleanerView && `(${sortedTasks.length})`}
                </CardTitle>
                {totalPages > 1 && (
                  <span className="text-xs text-gray-500">
                    Página {currentPage} de {totalPages}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <TasksList 
                tasks={paginatedTasks} 
                filters={filters} 
                isLoading={isLoading} 
                onShowHistory={onShowHistory}
                onCreateReport={onCreateReport}
                onOpenGroupedReport={onOpenGroupedReport}
                onAssignMultipleCleaners={onAssignMultipleCleaners}
                onRefetch={onRefetch}
              />
              
              <TasksPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={onPageChange}
              />
            </CardContent>
          </Card>
        )}

        {/* Sidebar widgets - AFTER task list on mobile */}
        {!showPastTasks && !cleanerView && (
          <div className="space-y-4">
            <TaskFilters filters={filters} onFiltersChange={onFiltersChange} />
            <CalendarIntegrationWidget tasks={tasks} />
            <RecurringTasksWidget />
          </div>
        )}
      </div>
    );
  }

  // Desktop layout remains unchanged
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Estadísticas - Solo mostrar para tareas actuales y no para limpiadoras */}
      {!showPastTasks && !cleanerView && <TaskStatsCard tasks={searchFilteredTasks} />}

      <div className={`grid grid-cols-1 ${cleanerView ? 'lg:grid-cols-1' : 'lg:grid-cols-4'} gap-6`}>
        {!showPastTasks && !cleanerView && (
          <div className="lg:col-span-1 space-y-6">
            <TaskFilters filters={filters} onFiltersChange={onFiltersChange} />
            <CalendarIntegrationWidget tasks={tasks} />
            <RecurringTasksWidget />
          </div>
        )}
        
        <div className={cleanerView ? "lg:col-span-1" : (showPastTasks ? "lg:col-span-4" : "lg:col-span-3")}>
          {/* Para limpiadoras: mostrar tareas separadas por secciones también en desktop */}
          {cleanerView && !showPastTasks ? (
            <div className="space-y-6">
              {/* Tareas de hoy */}
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                const todayTasks = paginatedTasks.filter(task => task.date === today);
                
                return todayTasks.length > 0 ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg text-primary font-semibold">
                        📅 TAREAS PARA HOY ({todayTasks.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <TasksList 
                        tasks={todayTasks} 
                        filters={filters} 
                        isLoading={isLoading} 
                        onShowHistory={onShowHistory}
                        onCreateReport={onCreateReport}
                        onOpenGroupedReport={onOpenGroupedReport}
                        onAssignMultipleCleaners={onAssignMultipleCleaners}
                        onRefetch={onRefetch}
                      />
                    </CardContent>
                  </Card>
                ) : null;
              })()}

              {/* Próximas tareas */}
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                const upcomingTasks = paginatedTasks
                  .filter(task => task.date > today)
                  .sort((a, b) => {
                    // Primero por fecha
                    const dateComparison = a.date.localeCompare(b.date);
                    if (dateComparison !== 0) return dateComparison;
                    
                    // Si la fecha es la misma, por hora de inicio
                    return a.startTime.localeCompare(b.startTime);
                  });
                
                return upcomingTasks.length > 0 ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg text-muted-foreground font-semibold">
                        ⏰ PRÓXIMAS TAREAS ({upcomingTasks.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <TasksList 
                        tasks={upcomingTasks} 
                        filters={filters} 
                        isLoading={isLoading} 
                        onShowHistory={onShowHistory}
                        onCreateReport={onCreateReport}
                        onOpenGroupedReport={onOpenGroupedReport}
                        onAssignMultipleCleaners={onAssignMultipleCleaners}
                        onRefetch={onRefetch}
                      />
                    </CardContent>
                  </Card>
                ) : null;
              })()}
              
              {totalPages > 1 && (
                <TasksPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={onPageChange}
                />
              )}
            </div>
          ) : (
            // Vista normal para no-limpiadoras o historial
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {cleanerView
                      ? 'Mis Tareas'
                      : (showPastTasks ? 'Historial de Tareas' : 'Lista de Tareas')
                    } {!cleanerView && `(${sortedTasks.length})`}
                  </CardTitle>
                  {totalPages > 1 && (
                    <span className="text-sm text-gray-500">
                      Página {currentPage} de {totalPages}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <TasksList 
                  tasks={paginatedTasks} 
                  filters={filters} 
                  isLoading={isLoading} 
                  onShowHistory={onShowHistory}
                  onCreateReport={onCreateReport}
                  onOpenGroupedReport={onOpenGroupedReport}
                  onAssignMultipleCleaners={onAssignMultipleCleaners}
                  onRefetch={onRefetch}
                />
                
                <TasksPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={onPageChange}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
