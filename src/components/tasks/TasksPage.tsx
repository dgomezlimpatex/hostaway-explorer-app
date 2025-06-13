
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ArrowLeft, Users, History } from "lucide-react";
import { Link } from "react-router-dom";
import { TasksList } from './TasksList';
import { TaskFilters } from './TaskFilters';
import { TaskStatsCard } from './components/TaskStatsCard';
import { CalendarIntegrationWidget } from './components/CalendarIntegrationWidget';
import { RecurringTasksWidget } from './components/RecurringTasksWidget';
import { TaskHistoryModal } from './components/TaskHistoryModal';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { BatchCreateTaskModal } from '@/components/modals/BatchCreateTaskModal';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useQuery } from '@tanstack/react-query';
import { taskStorageService } from '@/services/taskStorage';
import { Task } from '@/types/calendar';

export default function TasksPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBatchCreateModalOpen, setIsBatchCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    cleaner: 'all',
    dateRange: 'all',
    cliente: 'all',
    propiedad: 'all'
  });
  const [selectedTaskForHistory, setSelectedTaskForHistory] = useState<Task | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [showPastTasks, setShowPastTasks] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const tasksPerPage = 20;

  // Fetch all tasks without date filtering
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['all-tasks'],
    queryFn: async () => {
      console.log('TasksPage - fetching all tasks');
      const allTasks = await taskStorageService.getTasks();
      console.log('TasksPage - allTasks fetched:', allTasks);
      return allTasks;
    },
  });

  // Create task mutation
  const createTask = async (taskData: Omit<Task, 'id'>) => {
    await taskStorageService.createTask(taskData);
  };

  // Filter tasks by date (past vs future/today)
  const dateFilteredTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return tasks.filter(task => {
      const taskDate = new Date(task.date);
      taskDate.setHours(0, 0, 0, 0);
      
      if (showPastTasks) {
        return taskDate < today;
      } else {
        return taskDate >= today;
      }
    });
  }, [tasks, showPastTasks]);

  // Apply search filter
  const searchFilteredTasks = useMemo(() => {
    console.log('TasksPage - filtering tasks, total:', dateFilteredTasks.length);
    const filtered = dateFilteredTasks.filter(task => 
      task.property.toLowerCase().includes(searchTerm.toLowerCase()) || 
      task.address.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (task.cleaner && task.cleaner.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    console.log('TasksPage - search filtered tasks:', filtered.length);
    return filtered;
  }, [dateFilteredTasks, searchTerm]);

  // Sort tasks chronologically
  const sortedTasks = useMemo(() => {
    return [...searchFilteredTasks].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.startTime}`);
      const dateB = new Date(`${b.date}T${b.startTime}`);
      
      if (showPastTasks) {
        // For past tasks, show most recent first
        return dateB.getTime() - dateA.getTime();
      } else {
        // For future tasks, show earliest first
        return dateA.getTime() - dateB.getTime();
      }
    });
  }, [searchFilteredTasks, showPastTasks]);

  // Calculate pagination
  const totalPages = Math.ceil(sortedTasks.length / tasksPerPage);
  const startIndex = (currentPage - 1) * tasksPerPage;
  const endIndex = startIndex + tasksPerPage;
  const paginatedTasks = sortedTasks.slice(startIndex, endIndex);

  // Reset to first page when changing filters or search
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, showPastTasks, filters]);

  // Memoize handlers to prevent unnecessary re-renders
  const handleCreateTask = React.useCallback((taskData: any) => {
    createTask(taskData);
  }, []);

  const handleBatchCreateTasks = React.useCallback((tasksData: any[]) => {
    tasksData.forEach(taskData => {
      createTask(taskData);
    });
  }, []);

  const handleShowHistory = React.useCallback((task: Task) => {
    setSelectedTaskForHistory(task);
    setIsHistoryModalOpen(true);
  }, []);

  const handleOpenCreateModal = React.useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const handleOpenBatchModal = React.useCallback(() => {
    setIsBatchCreateModalOpen(true);
  }, []);

  const handleTogglePastTasks = () => {
    setShowPastTasks(!showPastTasks);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  console.log('TasksPage - rendering with tasks:', tasks.length, 'filtered:', sortedTasks.length, 'paginated:', paginatedTasks.length, 'isLoading:', isLoading);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="hover:bg-gray-100">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al Menú
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {showPastTasks ? 'Tareas Pasadas' : 'Gestión de Tareas'}
              </h1>
              <p className="text-gray-600">
                {showPastTasks 
                  ? 'Historial de tareas completadas y pasadas' 
                  : 'Administra y supervisa todas las tareas de limpieza'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle Past Tasks Button */}
            <Button 
              onClick={handleTogglePastTasks}
              variant="outline"
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              {showPastTasks ? 'Ver Tareas Actuales' : 'Ver Tareas Pasadas'}
            </Button>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input 
                placeholder="Buscar tareas..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="pl-10 w-64" 
              />
            </div>
            
            {!showPastTasks && (
              <>
                <Button 
                  onClick={handleOpenBatchModal} 
                  variant="outline" 
                  className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  <Users className="h-4 w-4" />
                  Crear Múltiples
                </Button>
                <Button onClick={handleOpenCreateModal} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva Tarea
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6 space-y-6">
        {/* Estadísticas - Solo mostrar para tareas actuales */}
        {!showPastTasks && <TaskStatsCard tasks={searchFilteredTasks} />}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {!showPastTasks && (
            <div className="lg:col-span-1 space-y-6">
              <TaskFilters filters={filters} onFiltersChange={setFilters} />
              <CalendarIntegrationWidget tasks={tasks} />
              <RecurringTasksWidget />
            </div>
          )}
          
          <div className={showPastTasks ? "lg:col-span-4" : "lg:col-span-3"}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {showPastTasks ? 'Historial de Tareas' : 'Lista de Tareas'} ({sortedTasks.length})
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
                  onShowHistory={handleShowHistory} 
                />
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6 flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        
                        {[...Array(totalPages)].map((_, index) => {
                          const page = index + 1;
                          const isCurrentPage = page === currentPage;
                          const showPage = 
                            page === 1 || 
                            page === totalPages || 
                            (page >= currentPage - 2 && page <= currentPage + 2);
                          
                          if (!showPage) {
                            if (page === currentPage - 3 || page === currentPage + 3) {
                              return (
                                <PaginationItem key={page}>
                                  <span className="px-3 py-2">...</span>
                                </PaginationItem>
                              );
                            }
                            return null;
                          }
                          
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => handlePageChange(page)}
                                isActive={isCurrentPage}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {!showPastTasks && (
          <>
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
          </>
        )}

        <TaskHistoryModal 
          task={selectedTaskForHistory} 
          open={isHistoryModalOpen} 
          onOpenChange={setIsHistoryModalOpen} 
        />
      </div>
    </div>
  );
}
