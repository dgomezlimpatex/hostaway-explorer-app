
import { useEffect, useMemo } from "react";
import { 
  UnassignedTasksWithSuspense, 
  CalendarModalsWithSuspense 
} from "./LazyCalendarComponents";
import { taskStorageService } from "@/services/taskStorage";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarLayout } from "./CalendarLayout";
import { DragPreview } from "./DragPreview";
import { StatusLegend } from "./StatusLegend";
import { OverlapAlertsBanner } from "./OverlapAlertsBanner";
import { Task, Cleaner, ViewType } from "@/types/calendar";
import { CleanerAvailability } from "@/hooks/useCleanerAvailability";
import { getTaskPosition, isTimeSlotOccupied } from "@/utils/taskPositioning";
import { formatMadridDate, getTodayMadrid } from "@/utils/date";

import { useWorkersAbsenceStatus } from "@/hooks/useWorkersAbsenceStatus";
import { usePreferredCleaners } from "@/hooks/usePropertyPreferredCleaners";
import { useCalendarWorkload } from "@/hooks/useCalendarWorkload";
import { useUnavailableCleaners } from "@/hooks/useUnavailableCleaners";
import { buildTaskAssignmentsMap, isTaskAssignedToCleaner } from "@/utils/taskAssignments";
import { materializeRecurringTaskInstance } from "@/services/recurringTaskInstanceService";
import type { DragState } from "@/hooks/useDragAndDrop";
import { MultiDayCalendarGrid } from "./MultiDayCalendarGrid";
import {
  buildCleanerDayCells,
  civilDateToLocalDate,
  getOverlapsByCleaner,
  getVisibleDays,
  isMultiDayView,
} from "./utils/multiDayCalendar";


type RecurringCalendarTask = Task & {
  isRecurringInstance?: boolean;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

export interface CalendarContainerProps {
  tasks: Task[];
  cleaners: Cleaner[];
  currentDate: Date;
  currentView: ViewType;
  timeSlots: string[];
  availability: CleanerAvailability[];
  headerScrollRef: React.RefObject<HTMLDivElement>;
  bodyScrollRef: React.RefObject<HTMLDivElement>;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  isBatchCreateModalOpen: boolean;
  setIsBatchCreateModalOpen: (open: boolean) => void;
  selectedTask: Task | null;
  isTaskModalOpen: boolean;
  setIsTaskModalOpen: (open: boolean) => void;
  dragState: DragState;
  handleDragStart: (e: React.DragEvent, task: Task) => void;
  handleDragEnd: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, cleanerId: string, cleaners: Cleaner[], timeSlot?: string) => void;
  handleHeaderScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleBodyScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleTaskClick: (task: Task) => void;
  handleCreateTask: (taskData: Omit<Task, 'id'>) => Promise<void>;
  handleBatchCreateTasks: (tasksData: Omit<Task, 'id'>[]) => Promise<void>;
  handleUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  handleDeleteTask: (taskId: string) => Promise<void>;
  handleUnassignTask: (taskId: string) => Promise<void>;
  onNavigateDate: (direction: 'prev' | 'next') => void;
  onSelectDay: (day: string) => void;
}

export const CalendarContainer = ({
  tasks,
  cleaners,
  currentDate,
  currentView,
  timeSlots,
  availability,
  headerScrollRef,
  bodyScrollRef,
  isCreateModalOpen,
  setIsCreateModalOpen,
  isBatchCreateModalOpen,
  setIsBatchCreateModalOpen,
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
  handleUpdateTask,
  handleDeleteTask,
  handleUnassignTask,
  onNavigateDate,
  onSelectDay
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

  // Assignments already come with the task query. Reuse them instead of
  // blocking calendar rendering on a second request for the same rows.
  const assignmentsMap = useMemo(
    () => buildTaskAssignmentsMap(assignedTasks),
    [assignedTasks],
  );

  // Fetch absence status for all cleaners on current date
  const cleanerIds = useMemo(() => cleaners.map(c => c.id), [cleaners]);
  const { data: absenceStatus } = useWorkersAbsenceStatus(cleanerIds, currentDate);

  // Workload data for all cleaners (viewed week)
  const { workloadMap } = useCalendarWorkload(currentDate);

  const isMultiDay = isMultiDayView(currentView);
  const visibleDays = useMemo(() => getVisibleDays(currentDate, currentView), [currentDate, currentView]);
  // The week view starts on Monday, not on the anchor date.
  const rangeStartDate = useMemo(() => civilDateToLocalDate(visibleDays[0]), [visibleDays]);

  // Cleaners fully unavailable across the visible range (full-day absence or fixed day off)
  const { unavailableIds } = useUnavailableCleaners(cleaners, rangeStartDate, currentView);

  // Cleaner IDs that have tasks assigned today — these stay visible even if "unavailable"
  const cleanersWithTasksTodayIds = useMemo(() => {
    const ids = new Set<string>();
    assignedTasks.forEach(t => {
      if (t.cleanerId) ids.add(t.cleanerId);
      if (t.cleaner) {
        const match = cleaners.find(c => isTaskAssignedToCleaner(t, c.id, c.name));
        if (match) ids.add(match.id);
      }
      assignmentsMap[t.id]?.forEach(cleanerId => ids.add(cleanerId));
    });
    return ids;
  }, [assignedTasks, cleaners, assignmentsMap]);

  // Final visible cleaners: hide unavailable ones unless they still have tasks assigned
  const visibleCleaners = useMemo(
    () => cleaners.filter(c => !unavailableIds.has(c.id) || cleanersWithTasksTodayIds.has(c.id)),
    [cleaners, unavailableIds, cleanersWithTasksTodayIds]
  );

  // Get preferred cleaners for the currently dragged task's property
  const draggedPropertyId = dragState.isDragging ? dragState.draggedTask?.propertyId : undefined;
  const { data: draggedTaskPreferred = [] } = usePreferredCleaners(draggedPropertyId);
  const preferredCleanerIdsForDrag = useMemo(() => 
    dragState.isDragging ? new Set(draggedTaskPreferred.map(p => p.cleaner_id)) : new Set<string>(),
    [draggedTaskPreferred, dragState.isDragging]
  );

  // Detect overlapping tasks by cleaner (only tasks on the same date can conflict)
  const overlapsByCleanerMap = useMemo(
    () => getOverlapsByCleaner(assignedTasks, cleaners, assignmentsMap),
    [assignedTasks, cleaners, assignmentsMap]
  );

  const multiDayCells = useMemo(
    () => isMultiDay ? buildCleanerDayCells(assignedTasks, visibleCleaners, visibleDays, assignmentsMap) : {},
    [isMultiDay, assignedTasks, visibleCleaners, visibleDays, assignmentsMap]
  );

  // Memoized time slot occupation check wrapper que excluye la tarea que se está arrastrando
  const checkTimeSlotOccupied = (cleanerId: string, hour: number, minute: number) => {
    return isTimeSlotOccupied(
      cleanerId, 
      hour, 
      minute, 
      assignedTasks, 
      cleaners, 
      dragState.draggedTask?.id, // Pasar el ID de la tarea que se está arrastrando
      assignmentsMap
    );
  };

  // Quick actions from EnhancedTaskCard context menu (decoupled via window events)
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const findTask = (id: string) => tasks.find(t => t.id === id);

    const optimisticRemove = (id: string) => {
      queryClient.setQueriesData(
        { predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === 'tasks' },
        (old: Task[] | undefined) => Array.isArray(old) ? old.filter(t => t.id !== id) : old
      );
    };

    const handleDuplicate = async (e: Event) => {
      const { taskId } = (e as CustomEvent).detail || {};
      const t = findTask(taskId);
      if (!t) return;
      try {
        const { id, created_at, updated_at, ...rest } = t;
        await taskStorageService.createTask({
          ...rest,
          status: 'pending',
        });
        queryClient.invalidateQueries({
          predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === 'tasks',
        });
        toast({ title: 'Tarea duplicada', description: 'Se ha creado una copia.' });
      } catch (err: unknown) {
        toast({ title: 'Error', description: getErrorMessage(err, 'No se pudo duplicar.'), variant: 'destructive' });
      }
    };

    const handleUnassign = async (e: Event) => {
      const { taskId } = (e as CustomEvent).detail || {};
      const t = findTask(taskId);
      if (!t) return;

      try {
        if ((t as RecurringCalendarTask).isRecurringInstance) {
          await materializeRecurringTaskInstance(t, {
            cleaner: undefined,
            cleanerId: undefined,
            status: 'pending',
          });

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['recurring-task-executions'] }),
            queryClient.invalidateQueries({ queryKey: ['recurring-tasks-for-calendar'] }),
            queryClient.invalidateQueries({ queryKey: ['tasks'] }),
          ]);

          toast({
            title: 'Ocurrencia desasignada',
            description: 'Se ha creado una tarea individual sin asignar para esta fecha.',
          });
          return;
        }

        await handleUnassignTask(taskId);
      } catch (err: unknown) {
        toast({
          title: 'Error',
          description: getErrorMessage(err, 'No se pudo desasignar la tarea.'),
          variant: 'destructive',
        });
      }
    };

    const handleDelete = async (e: Event) => {
      const { taskId } = (e as CustomEvent).detail || {};
      if (!window.confirm('¿Eliminar esta tarea? Esta acción no se puede deshacer.')) return;
      optimisticRemove(taskId);
      try {
        await handleDeleteTask(taskId);
      } catch {
        queryClient.invalidateQueries({
          predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === 'tasks',
        });
      }
    };

    window.addEventListener('task:duplicate', handleDuplicate);
    window.addEventListener('task:unassign', handleUnassign);
    window.addEventListener('task:delete', handleDelete);
    return () => {
      window.removeEventListener('task:duplicate', handleDuplicate);
      window.removeEventListener('task:unassign', handleUnassign);
      window.removeEventListener('task:delete', handleDelete);
    };
  }, [tasks, queryClient, toast, handleUnassignTask, handleDeleteTask]);

  return (
    <>
      {/* Overlap Alerts - Compact collapsible banner */}
      <OverlapAlertsBanner
        overlapsByCleanerMap={overlapsByCleanerMap}
        cleaners={cleaners}
        showDate={isMultiDay}
        resetKey={visibleDays.join(',')}
      />


      {/* Main Layout with Unassigned Tasks on Left and Calendar on Right */}
      <div className="flex gap-2 w-full flex-1 min-h-0">
        {/* Unassigned Tasks Column - Only show when there are unassigned tasks */}
        {unassignedTasks.length > 0 && (
          <div className="w-64 flex-shrink-0 overflow-auto">
            <UnassignedTasksWithSuspense
              tasks={unassignedTasks}
              onTaskClick={handleTaskClick}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          </div>
        )}

        {/* Main Calendar */}
        <div className="flex-1 min-w-0 flex flex-col">
          {isMultiDay ? (
            <MultiDayCalendarGrid
              cleaners={visibleCleaners}
              days={visibleDays}
              cells={multiDayCells}
              todayStr={formatMadridDate(getTodayMadrid())}
              dragState={dragState}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onTaskClick={handleTaskClick}
              onSelectDay={onSelectDay}
              assignmentsMap={assignmentsMap}
              workloadMap={workloadMap}
              preferredCleanerIds={preferredCleanerIdsForDrag}
            />
          ) : (
          <CalendarLayout
            cleaners={visibleCleaners}
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
            isDragging={dragState.isDragging}
            preferredCleanerIds={preferredCleanerIdsForDrag}
            workloadMap={workloadMap}
          />
          )}
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
        selectedTask={selectedTask}
        isTaskModalOpen={isTaskModalOpen}
        setIsTaskModalOpen={setIsTaskModalOpen}
        currentDate={currentDate}
        onCreateTask={handleCreateTask}
        onBatchCreateTasks={handleBatchCreateTasks}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onUnassignTask={handleUnassignTask}
      />
    </>
  );
};
