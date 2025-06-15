
import React from 'react';
import { Task } from '@/types/calendar';
import { TaskCard } from './components/TaskCard';
import { Skeleton } from '@/components/ui/skeleton';
import { VirtualizedTable } from '@/components/ui/virtualized-table';

interface VirtualizedTasksListProps {
  tasks: Task[];
  filters: any;
  isLoading: boolean;
  onShowHistory: (task: Task) => void;
  onCreateReport: (task: Task) => void;
  height: number;
}

export const VirtualizedTasksList: React.FC<VirtualizedTasksListProps> = ({
  tasks,
  filters,
  isLoading,
  onShowHistory,
  onCreateReport,
  height,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No hay tareas disponibles.</p>
      </div>
    );
  }

  const renderTaskItem = (item: Task & { index: number }) => {
    return (
      <div className="p-2">
        <TaskCard 
          task={item} 
          onShowHistory={onShowHistory}
          onCreateReport={onCreateReport}
        />
      </div>
    );
  };

  return (
    <VirtualizedTable
      data={tasks}
      height={height}
      itemHeight={160}
      renderItem={renderTaskItem}
      className="w-full"
    />
  );
};
