import { RecurringTasksList } from '@/components/recurring-tasks/RecurringTasksList';
import { CreateRecurringTaskModal } from '@/components/modals/CreateRecurringTaskModal';
import { UpcomingTasksPreview } from '@/components/recurring-tasks/UpcomingTasksPreview';
import { RecurringTasksMetrics } from '@/components/recurring-tasks/RecurringTasksMetrics';
import { useProcessRecurringTasks } from '@/hooks/useProcessRecurringTasks';
import { Plus, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export const RecurringTasksPage = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const processRecurringTasks = useProcessRecurringTasks();

  const handleProcessTasks = () => {
    processRecurringTasks.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tareas Recurrentes</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleProcessTasks}
            disabled={processRecurringTasks.isPending}
          >
            {processRecurringTasks.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Procesar Ahora
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Tarea Recurrente
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <RecurringTasksMetrics />

      {/* Vista previa de próximas ejecuciones */}
      <UpcomingTasksPreview />

      {/* Lista de tareas recurrentes */}
      <RecurringTasksList />

      <CreateRecurringTaskModal 
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
};

export default RecurringTasksPage;