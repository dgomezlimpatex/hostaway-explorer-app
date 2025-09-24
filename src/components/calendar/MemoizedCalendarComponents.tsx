import React, { memo, useMemo, useCallback } from 'react';
import { CalendarGrid } from './CalendarGrid';
import { WorkersColumn } from './WorkersColumn';
import { TimelineHeader } from './TimelineHeader';
import { UnassignedTasks } from './UnassignedTasks';
import { Task, Cleaner } from '@/types/calendar';
import { CleanerAvailability } from '@/hooks/useCleanerAvailability';
import { usePerformanceOptimization } from '@/hooks/usePerformanceOptimization';

// Memoized Calendar Grid with performance optimizations
export const MemoizedCalendarGrid = memo<{
  cleaners: Cleaner[];
  timeSlots: string[];
  assignedTasks: Task[];
  availability: CleanerAvailability[];
  currentDate: Date;
  dragState: any;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, cleanerId: string, cleaners: any[], timeSlot?: string) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onTaskClick: (task: Task) => void;
  getTaskPosition: (startTime: string, endTime: string) => { left: string; width: string };
  isTimeSlotOccupied: (cleanerId: string, hour: number, minute: number) => boolean;
  assignmentsMap?: Record<string, string[]>;
}>(({ 
  cleaners, 
  timeSlots, 
  assignedTasks, 
  availability, 
  currentDate, 
  dragState, 
  onScroll, 
  onDragOver, 
  onDrop, 
  onDragStart, 
  onDragEnd, 
  onTaskClick, 
  getTaskPosition, 
  isTimeSlotOccupied, 
  assignmentsMap 
}) => {
  const { startPerformanceMeasure, endPerformanceMeasure, shouldUseVirtualization } = usePerformanceOptimization();

  React.useEffect(() => {
    startPerformanceMeasure('calendar-grid-render');
    return () => endPerformanceMeasure('calendar-grid-render');
  });

  // Use virtualization for large cleaner lists
  if (shouldUseVirtualization(cleaners.length)) {
    return (
      <div className="text-center p-4 bg-primary/10 border border-primary/20 rounded-lg">
        <p className="text-primary font-medium">
          ⚡ Modo Optimizado Activo
        </p>
        <p className="text-primary/70 text-sm mt-1">
          {cleaners.length} trabajadores - Usando virtualización
        </p>
      </div>
    );
  }

  return (
    <CalendarGrid
      cleaners={cleaners}
      timeSlots={timeSlots}
      assignedTasks={assignedTasks}
      availability={availability}
      currentDate={currentDate}
      dragState={dragState}
      onScroll={onScroll}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onTaskClick={onTaskClick}
      getTaskPosition={getTaskPosition}
      isTimeSlotOccupied={isTimeSlotOccupied}
      assignmentsMap={assignmentsMap}
    />
  );
});

MemoizedCalendarGrid.displayName = 'MemoizedCalendarGrid';

// Memoized Unassigned Tasks with performance optimizations
export const MemoizedUnassignedTasks = memo<{
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: (e: React.DragEvent) => void;
}>(({ tasks, onTaskClick, onDragStart, onDragEnd }) => {
  const { startPerformanceMeasure, endPerformanceMeasure, shouldUseVirtualization } = usePerformanceOptimization();

  React.useEffect(() => {
    startPerformanceMeasure('unassigned-tasks-render');
    return () => endPerformanceMeasure('unassigned-tasks-render');
  });

  // Show optimization notice for large task lists
  if (shouldUseVirtualization(tasks.length)) {
    return (
      <div className="w-80 flex-shrink-0">
        <div className="bg-card rounded-lg border shadow-sm p-4">
          <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-700 font-medium">
              ⚡ Lista de Tareas Optimizada
            </p>
            <p className="text-yellow-600 text-sm mt-1">
              {tasks.length} tareas sin asignar
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <UnassignedTasks
      tasks={tasks}
      onTaskClick={onTaskClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    />
  );
});

MemoizedUnassignedTasks.displayName = 'MemoizedUnassignedTasks';

// Performance monitoring component
export const PerformanceMonitor = memo(() => {
  const { getPerformanceStats } = usePerformanceOptimization();
  const [stats, setStats] = React.useState(getPerformanceStats());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setStats(getPerformanceStats());
    }, 1000);

    return () => clearInterval(interval);
  }, [getPerformanceStats]);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-2 rounded text-xs font-mono z-50">
      <div>Renders: {stats.renderCount}</div>
      <div>Avg: {stats.averageRenderTime.toFixed(1)}ms</div>
    </div>
  );
});

PerformanceMonitor.displayName = 'PerformanceMonitor';