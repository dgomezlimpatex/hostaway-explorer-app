
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VirtualizedTasksList } from '../VirtualizedTasksList';
import { TaskFilters } from '../TaskFilters';
import { TaskStatsCard } from './TaskStatsCard';
import { CalendarIntegrationWidget } from './CalendarIntegrationWidget';
import { RecurringTasksWidget } from './RecurringTasksWidget';
import { TasksPagination } from './TasksPagination';
import { Task } from '@/types/calendar';

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
  onFiltersChange: (filters: any) => void;
  onShowHistory: (task: Task) => void;
  onCreateReport: (task: Task) => void;
  onPageChange: (page: number) => void;
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
  onPageChange,
}: TasksPageContentProps) => {
  const { userRole } = useAuth();
  const isCleaner = userRole === 'cleaner';
  const searchFilteredTasks = sortedTasks;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Estadísticas - Solo mostrar para tareas actuales y no para limpiadoras */}
      {!showPastTasks && !isCleaner && <TaskStatsCard tasks={searchFilteredTasks} />}

      <div className={`grid grid-cols-1 ${isCleaner ? 'lg:grid-cols-1' : 'lg:grid-cols-4'} gap-6`}>
        {!showPastTasks && !isCleaner && (
          <div className="lg:col-span-1 space-y-6">
            <TaskFilters filters={filters} onFiltersChange={onFiltersChange} />
            <CalendarIntegrationWidget tasks={tasks} />
            <RecurringTasksWidget />
          </div>
        )}
        
        <div className={isCleaner ? "lg:col-span-1" : (showPastTasks ? "lg:col-span-4" : "lg:col-span-3")}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {isCleaner 
                    ? `Mis Tareas Asignadas (${sortedTasks.length})`
                    : (showPastTasks ? 'Historial de Tareas' : 'Lista de Tareas')
                  } {!isCleaner && `(${sortedTasks.length})`}
                </CardTitle>
                {totalPages > 1 && (
                  <span className="text-sm text-gray-500">
                    Página {currentPage} de {totalPages}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Use virtualized list for better performance */}
              <VirtualizedTasksList 
                tasks={paginatedTasks} 
                filters={filters} 
                isLoading={isLoading} 
                onShowHistory={onShowHistory}
                onCreateReport={onCreateReport}
                height={600} 
              />
              
              <TasksPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={onPageChange}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
