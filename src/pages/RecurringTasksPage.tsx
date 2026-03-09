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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-bold">Tareas Recurrentes</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            variant="outline"
            size="sm"
            onClick={handleProcessTasks}
            disabled={processRecurringTasks.isPending}
            className="flex-1 sm:flex-none"
          >
            {processRecurringTasks.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            <span className="hidden sm:inline">Procesar Ahora</span>
            <span className="sm:hidden">Procesar</span>
          </Button>
          <Button size="sm" onClick={() => setShowCreateModal(true)} className="flex-1 sm:flex-none">
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Nueva Tarea Recurrente</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
        </div>
      </div>

      <RecurringTasksMetrics />
      <UpcomingTasksPreview />
      <RecurringTasksList />

      <CreateRecurringTaskModal 
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
};

export default RecurringTasksPage;
