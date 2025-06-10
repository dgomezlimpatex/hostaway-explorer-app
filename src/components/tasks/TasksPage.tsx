import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ArrowLeft, History } from "lucide-react";
import { Link } from "react-router-dom";
import { TasksList } from './TasksList';
import { TaskFilters } from './TaskFilters';
import { TaskStatsCard } from './components/TaskStatsCard';
import { CalendarIntegrationWidget } from './components/CalendarIntegrationWidget';
import { TaskHistoryModal } from './components/TaskHistoryModal';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { useCalendarData } from '@/hooks/useCalendarData';
import { Task } from '@/types/calendar';
export default function TasksPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    cleaner: 'all',
    dateRange: 'all'
  });
  const [selectedTaskForHistory, setSelectedTaskForHistory] = useState<Task | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const {
    tasks,
    createTask,
    isLoading
  } = useCalendarData();
  const handleCreateTask = (taskData: any) => {
    createTask(taskData);
  };
  const handleShowHistory = (task: Task) => {
    setSelectedTaskForHistory(task);
    setIsHistoryModalOpen(true);
  };

  // Filter tasks by search term
  const filteredTasks = tasks.filter(task => task.property.toLowerCase().includes(searchTerm.toLowerCase()) || task.address.toLowerCase().includes(searchTerm.toLowerCase()) || task.cleaner && task.cleaner.toLowerCase().includes(searchTerm.toLowerCase()));
  return <div className="min-h-screen bg-gray-50">
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
              <h1 className="text-3xl font-bold text-gray-900">Gestión de Tareas</h1>
              <p className="text-gray-600">Administra todas las tareas de limpieza</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input placeholder="Buscar tareas..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-64" />
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
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
          </div>
          
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lista de Tareas ({filteredTasks.length})</CardTitle>
                  
                </div>
              </CardHeader>
              <CardContent>
                <TasksList tasks={filteredTasks} filters={filters} isLoading={isLoading} onShowHistory={handleShowHistory} />
              </CardContent>
            </Card>
          </div>
        </div>

        <CreateTaskModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} onCreateTask={handleCreateTask} />

        <TaskHistoryModal task={selectedTaskForHistory} open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen} />
      </div>
    </div>;
}