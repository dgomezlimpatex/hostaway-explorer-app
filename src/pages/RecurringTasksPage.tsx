import React, { useState } from 'react';
import { RecurringTasksList } from '@/components/recurring-tasks/RecurringTasksList';
import { CreateRecurringTaskModal } from '@/components/modals/CreateRecurringTaskModal';
import { useProcessRecurringTasks } from '@/hooks/useRecurringTasks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Clock, Calendar, BarChart3 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const RecurringTasksPage = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const processRecurringTasks = useProcessRecurringTasks();

  const handleProcessTasks = async () => {
    try {
      await processRecurringTasks.mutateAsync();
      toast({
        title: "Procesamiento completado",
        description: "Las tareas recurrentes han sido procesadas exitosamente.",
      });
    } catch (error) {
      console.error('Error processing recurring tasks:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al procesar las tareas recurrentes.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Tareas Recurrentes</h1>
          <p className="text-muted-foreground">
            Gestiona y automatiza tus tareas repetitivas
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleProcessTasks}
            disabled={processRecurringTasks.isPending}
          >
            <Play className="h-4 w-4 mr-2" />
            {processRecurringTasks.isPending ? 'Procesando...' : 'Procesar Ahora'}
          </Button>
          
          <Button onClick={() => setIsCreateModalOpen(true)}>
            Nueva Tarea Recurrente
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tareas Activas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              Tareas recurrentes en funcionamiento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximas Ejecuciones</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              En los próximos 7 días
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tareas Generadas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              Este mes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <RecurringTasksList onCreateNew={() => setIsCreateModalOpen(true)} />

      {/* Create modal */}
      <CreateRecurringTaskModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
    </div>
  );
};

export default RecurringTasksPage;