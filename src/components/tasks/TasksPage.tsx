
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TasksList } from './TasksList';
import { TaskFilters } from './TaskFilters';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { useCalendarData } from '@/hooks/useCalendarData';

export default function TasksPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    cleaner: 'all',
    dateRange: 'all'
  });

  const { tasks, createTask, isLoading } = useCalendarData();

  const handleCreateTask = (taskData: any) => {
    createTask(taskData);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Tareas</h1>
          <p className="text-gray-600">Administra todas las tareas de limpieza</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nueva Tarea
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <TaskFilters filters={filters} onFiltersChange={setFilters} />
        </div>
        
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Tareas</CardTitle>
            </CardHeader>
            <CardContent>
              <TasksList tasks={tasks} filters={filters} isLoading={isLoading} />
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateTaskModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreateTask={handleCreateTask}
      />
    </div>
  );
}
