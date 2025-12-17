
import { useMemo } from "react";
import { 
  UnassignedTasksWithSuspense, 
  CalendarModalsWithSuspense 
} from "./LazyCalendarComponents";
import { CalendarLayout } from "./CalendarLayout";
import { DragPreview } from "./DragPreview";
import { StatusLegend } from "./StatusLegend";
import { OverlapAlert } from "./OverlapAlert";
import { Task, Cleaner } from "@/types/calendar";
import { CleanerAvailability } from "@/hooks/useCleanerAvailability";
import { getTaskPosition, isTimeSlotOccupied, detectTaskOverlaps } from "@/utils/taskPositioning";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkersAbsenceStatus } from "@/hooks/useWorkersAbsenceStatus";

export interface CalendarContainerProps {
  tasks: Task[];
  cleaners: Cleaner[];
  currentDate: Date;
  timeSlots: string[];
  availability: CleanerAvailability[];
  headerScrollRef: React.RefObject<HTMLDivElement>;
  bodyScrollRef: React.RefObject<HTMLDivElement>;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  isBatchCreateModalOpen: boolean;
  setIsBatchCreateModalOpen: (open: boolean) => void;
  isExtraordinaryServiceModalOpen: boolean;
  setIsExtraordinaryServiceModalOpen: (open: boolean) => void;
  selectedTask: Task | null;
  isTaskModalOpen: boolean;
  setIsTaskModalOpen: (open: boolean) => void;
  dragState: any;
  handleDragStart: (e: React.DragEvent, task: Task) => void;
  handleDragEnd: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, cleanerId: string, cleaners: any[], timeSlot?: string) => void;
  handleHeaderScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleBodyScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleTaskClick: (task: Task) => void;
  handleCreateTask: (taskData: Omit<Task, 'id'>) => Promise<void>;
  handleBatchCreateTasks: (tasksData: Omit<Task, 'id'>[]) => Promise<void>;
  handleCreateExtraordinaryService: (serviceData: any) => Promise<void>;
  handleUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  handleDeleteTask: (taskId: string) => Promise<void>;
  handleUnassignTask: (taskId: string) => Promise<void>;
  onNavigateDate: (direction: 'prev' | 'next') => void;
}

export const CalendarContainer = ({
  tasks,
  cleaners,
  currentDate,
  timeSlots,
  availability,
  headerScrollRef,
  bodyScrollRef,
  isCreateModalOpen,
  setIsCreateModalOpen,
  isBatchCreateModalOpen,
  setIsBatchCreateModalOpen,
  isExtraordinaryServiceModalOpen,
  setIsExtraordinaryServiceModalOpen,
  selectedTask,
  isTaskModalOpen,
  setIsTaskModalOpen,
  dragState,
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDrop,
  handleHeaderScroll,
  handleBodyScroll,
  handleTaskClick,
  handleCreateTask,
  handleBatchCreateTasks,
  handleCreateExtraordinaryService,
  handleUpdateTask,
  handleDeleteTask,
  handleUnassignTask,
  onNavigateDate
}: CalendarContainerProps) => {
  // Note: Mobile cleaner view logic moved to CleaningCalendar component
  // to avoid conditional hooks execution

  // Memoized task filtering for desktop view
  const { assignedTasks, unassignedTasks } = useMemo(() => {
    console.log('📦 CalendarContainer - Processing tasks:', {
      totalTasks: tasks.length,
      currentDateStr: currentDate.toISOString().split('T')[0],
      firstFewTasks: tasks.slice(0, 5).map(t => ({ 
        id: t.id, 
        date: t.date, 
        property: t.property, 
        cleaner: t.cleaner, 
        cleanerId: t.cleanerId 
      }))
    });
    
    // A task is considered assigned if it has either cleaner name OR cleaner_id
    const assigned = tasks.filter(task => task.cleaner || task.cleanerId);
    // A task is unassigned if it has neither cleaner name NOR cleaner_id
    const unassigned = tasks.filter(task => !task.cleaner && !task.cleanerId);
    
    console.log('📦 CalendarContainer - Task separation result:', {
      assignedCount: assigned.length,
      unassignedCount: unassigned.length,
      assignedSample: assigned.slice(0, 3).map(t => ({ 
        id: t.id, 
        property: t.property, 
        cleaner: t.cleaner, 
        cleanerId: t.cleanerId 
      })),
      unassignedSample: unassigned.slice(0, 3).map(t => ({ 
        id: t.id, 
        property: t.property, 
        cleaner: t.cleaner, 
        cleanerId: t.cleanerId 
      }))
    });
    
    return { assignedTasks: assigned, unassignedTasks: unassigned };
  }, [tasks, currentDate]);

  // Build assignments map for visible assigned tasks (task_id -> [cleaner_id])
  const taskIds = useMemo(() => assignedTasks.map(t => t.id), [assignedTasks]);

  const { data: assignmentRows = [] } = useQuery<{ task_id: string; cleaner_id: string }[]>({
    queryKey: ['taskAssignmentsForCalendar', taskIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_assignments')
        .select('task_id, cleaner_id')
        .in('task_id', taskIds);
      if (error) throw error;
      return data as { task_id: string; cleaner_id: string }[];
    },
    enabled: taskIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const assignmentsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    (assignmentRows || []).forEach(row => {
      if (!map[row.task_id]) map[row.task_id] = [];
      map[row.task_id].push(row.cleaner_id);
    });
    return map;
  }, [assignmentRows]);

  // Fetch absence status for all cleaners on current date
  const cleanerIds = useMemo(() => cleaners.map(c => c.id), [cleaners]);
  const { data: absenceStatus } = useWorkersAbsenceStatus(cleanerIds, currentDate);

  // Detect overlapping tasks by cleaner
  const overlapsByCleanerMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    
    cleaners.forEach(cleaner => {
      const cleanerTasks = assignedTasks.filter(task => 
        task.cleaner === cleaner.name || task.cleanerId === cleaner.id
      );
      
      const overlaps: any[] = [];
      cleanerTasks.forEach(task => {
        const taskOverlaps = detectTaskOverlaps(
          cleaner.id,
          task.startTime,
          task.endTime,
          cleanerTasks,
          cleaners,
          task.id
        );
        
        if (taskOverlaps.length > 0) {
          overlaps.push(...taskOverlaps.filter(overlap => 
            !overlaps.some(existing => existing.id === overlap.id)
          ));
        }
      });
      
      if (overlaps.length > 0) {
        map[cleaner.id] = overlaps;
      }
    });
    
    return map;
  }, [assignedTasks, cleaners]);

  // Memoized time slot occupation check wrapper que excluye la tarea que se está arrastrando
  const checkTimeSlotOccupied = (cleanerId: string, hour: number, minute: number) => {
    return isTimeSlotOccupied(
      cleanerId, 
      hour, 
      minute, 
      assignedTasks, 
      cleaners, 
      dragState.draggedTask?.id // Pasar el ID de la tarea que se está arrastrando
    );
  };

  return (
    <>
      {/* Overlap Alerts - Show at the top */}
      {Object.keys(overlapsByCleanerMap).length > 0 && (
        <div className="mb-4 space-y-2">
          {Object.entries(overlapsByCleanerMap).map(([cleanerId, overlaps]) => {
            const cleaner = cleaners.find(c => c.id === cleanerId);
            return cleaner ? (
              <OverlapAlert
                key={cleanerId}
                overlappingTasks={overlaps}
                cleanerName={cleaner.name}
              />
            ) : null;
          })}
        </div>
      )}

      {/* Main Layout with Unassigned Tasks on Left and Calendar on Right */}
      <div className="flex gap-2 h-[600px] w-full">
        {/* Unassigned Tasks Column - Only show when there are unassigned tasks */}
        {unassignedTasks.length > 0 && (
          <div className="w-64 flex-shrink-0">
            <UnassignedTasksWithSuspense
              tasks={unassignedTasks}
              onTaskClick={handleTaskClick}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          </div>
        )}

        {/* Main Calendar */}
        <div className="flex-1 min-w-0">
          <CalendarLayout
            cleaners={cleaners}
            timeSlots={timeSlots}
            assignedTasks={assignedTasks}
            availability={availability}
            currentDate={currentDate}
            dragState={dragState}
            headerScrollRef={headerScrollRef}
            bodyScrollRef={bodyScrollRef}
            onHeaderScroll={handleHeaderScroll}
            onBodyScroll={handleBodyScroll}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onTaskClick={handleTaskClick}
            getTaskPosition={getTaskPosition}
            isTimeSlotOccupied={checkTimeSlotOccupied}
            assignmentsMap={assignmentsMap}
            absenceStatus={absenceStatus}
          />
        </div>
      </div>

      {/* Drag Preview with Enhanced Styling */}
      {dragState.draggedTask && (
        <DragPreview
          task={dragState.draggedTask}
          isDragging={dragState.isDragging}
          offset={dragState.dragOffset}
        />
      )}

      {/* Enhanced Status Legend */}
      <StatusLegend />

      {/* Modals - Lazy loaded */}
      <CalendarModalsWithSuspense
        isCreateModalOpen={isCreateModalOpen}
        setIsCreateModalOpen={setIsCreateModalOpen}
        isBatchCreateModalOpen={isBatchCreateModalOpen}
        setIsBatchCreateModalOpen={setIsBatchCreateModalOpen}
        isExtraordinaryServiceModalOpen={isExtraordinaryServiceModalOpen}
        setIsExtraordinaryServiceModalOpen={setIsExtraordinaryServiceModalOpen}
        selectedTask={selectedTask}
        isTaskModalOpen={isTaskModalOpen}
        setIsTaskModalOpen={setIsTaskModalOpen}
        currentDate={currentDate}
        onCreateTask={handleCreateTask}
        onBatchCreateTasks={handleBatchCreateTasks}
        onCreateExtraordinaryService={handleCreateExtraordinaryService}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onUnassignTask={handleUnassignTask}
      />
    </>
  );
};
