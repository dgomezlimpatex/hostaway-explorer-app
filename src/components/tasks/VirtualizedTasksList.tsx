
import React from 'react';
import { FixedSizeList as List } from 'react-window';
import { Task } from '@/types/calendar';
import { TaskCard } from './components/TaskCard';
import { Skeleton } from '@/components/ui/skeleton';

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

  const TaskItem = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const task = tasks[index];
    return (
      <div style={style} className="p-2">
        <TaskCard 
          task={task} 
          onShowHistory={onShowHistory}
          onCreateReport={onCreateReport}
        />
      </div>
    );
  };

  return (
    <List
      height={height}
      itemCount={tasks.length}
      itemSize={160} // Altura de cada card + padding
      width="100%"
    >
      {TaskItem}
    </List>
  );
};
