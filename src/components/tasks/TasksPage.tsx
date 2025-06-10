
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ArrowLeft, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { TasksList } from './TasksList';
import { TaskFilters } from './TaskFilters';
import { TaskStatsCard } from './components/TaskStatsCard';
import { CalendarIntegrationWidget } from './components/CalendarIntegrationWidget';
import { RecurringTasksWidget } from './components/RecurringTasksWidget';
import { TaskHistoryModal } from './components/TaskHistoryModal';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { BatchCreateTaskModal } from '@/components/modals/BatchCreateTaskModal';
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

  // Memoize filtered tasks to avoid recalculation on every render
  const filteredTasks = useMemo(() => {
    console.log('TasksPage - filtering tasks, total:', tasks.length);
    const filtered = tasks.filter(task => 
      task.property.toLowerCase().includes(searchTerm.toLowerCase()) || 
      task.address.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (task.cleaner && task.cleaner.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    console.log('TasksPage - filtered tasks:', filtered.length);
    return filtered;
  }, [tasks, searchTerm]);

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

  console.log('TasksPage - rendering with tasks:', tasks.length, 'filtered:', filteredTasks.length, 'isLoading:', isLoading);

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
              <h1 className="text-2xl font-bold text-gray-900">Gestión de Tareas</h1>
              <p className="text-gray-600">Administra y supervisa todas las tareas de limpieza</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6 space-y-6">
        {/* Estadísticas */}
        <TaskStatsCard tasks={filteredTasks} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <TaskFilters filters={filters} onFiltersChange={setFilters} />
            <CalendarIntegrationWidget tasks={tasks} />
            <RecurringTasksWidget />
          </div>
          
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lista de Tareas ({filteredTasks.length})</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <TasksList 
                  tasks={filteredTasks} 
                  filters={filters} 
                  isLoading={isLoading} 
                  onShowHistory={handleShowHistory} 
                />
              </CardContent>
            </Card>
          </div>
        </div>

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

        <TaskHistoryModal 
          task={selectedTaskForHistory} 
          open={isHistoryModalOpen} 
          onOpenChange={setIsHistoryModalOpen} 
        />
      </div>
    </div>
  );
}
