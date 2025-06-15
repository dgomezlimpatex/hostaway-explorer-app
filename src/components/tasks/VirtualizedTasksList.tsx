
import React, { memo, useMemo, useCallback } from 'react';
import { VirtualizedTable } from '@/components/ui/virtualized-table';
import { TaskCard } from './components/TaskCard';
import { Task } from '@/types/calendar';
import { useTaskActions } from './hooks/useTaskActions';

interface VirtualizedTasksListProps {
  tasks: Task[];
  filters: any;
  isLoading: boolean;
  onShowHistory: (task: Task) => void;
  height?: number;
}

export const VirtualizedTasksList = memo(({
  tasks,
  filters,
  isLoading,
  onShowHistory,
  height = 600
}: VirtualizedTasksListProps) => {
  const {
    handleEditTask,
    handleDeleteTask,
    handleQuickStatusChange,
    handleAssignCleaner,
    getStatusColor,
    getStatusText
  } = useTaskActions();

  const memoizedRenderItem = useCallback((item: Task & { index: number }) => (
    <div className="p-2">
      <TaskCard
        key={item.id}
        task={item}
        onEditTask={handleEditTask}
        onDeleteTask={handleDeleteTask}
        onQuickStatusChange={handleQuickStatusChange}
        onAssignCleaner={handleAssignCleaner}
        onShowHistory={onShowHistory}
        getStatusColor={getStatusColor}
        getStatusText={getStatusText}
      />
    </div>
  ), [
    handleEditTask,
    handleDeleteTask,
    handleQuickStatusChange,
    handleAssignCleaner,
    onShowHistory,
    getStatusColor,
    getStatusText
  ]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando tareas...</span>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        No se encontraron tareas con los filtros aplicados.
      </div>
    );
  }

  return (
    <VirtualizedTable
      data={tasks}
      height={height}
      itemHeight={200} // Altura estimada de cada TaskCard
      renderItem={memoizedRenderItem}
      className="w-full"
      overscan={3}
    />
  );
});

VirtualizedTasksList.displayName = 'VirtualizedTasksList';
