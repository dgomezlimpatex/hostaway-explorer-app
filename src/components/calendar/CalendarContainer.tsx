
import { useCallback, useEffect, useMemo } from "react";
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
import { buildTimeSlotOccupancy, getTaskPosition } from "@/utils/taskPositioning";
import { formatMadridDate, getTodayMadrid } from "@/utils/date";

import { useWorkersAbsenceStatus } from "@/hooks/useWorkersAbsenceStatus";
import { usePreferredCleaners } from "@/hooks/usePropertyPreferredCleaners";
import { useCalendarWorkload } from "@/hooks/useCalendarWorkload";
import { useUnavailableCleaners } from "@/hooks/useUnavailableCleaners";
import { buildTaskAssignmentsMap, isTaskAssigned, isTaskAssignedToCleaner } from "@/utils/taskAssignments";
import { getCleanerAvailabilityForDay } from "@/utils/availabilityUtils";
import { materializeRecurringTaskInstance } from "@/services/recurringTaskInstanceService";
import type { DragState } from "@/hooks/useDragAndDrop";
import type { ConfirmFn } from "./useConfirmDialog";
import { MultiDayCalendarGrid } from "./MultiDayCalendarGrid";
import {
  buildCleanerDayCells,
  civilDateToLocalDate,
  getOverlapsByCleaner,
  getVisibleDays,
  isMultiDayView,
} from "./utils/multiDayCalendar";
import { CalendarActionsProvider, FULL_CALENDAR_PERMISSIONS, type CalendarActionsValue, type CalendarPermissions } from "./CalendarActionsContext";
import { buildTimeSlots, getTimelineBounds, ZOOM_SLOT_WIDTH, type TimelineScale, type TimelineZoom } from "./utils/timelineScale";
import { buildUnassignedDuplicate } from "./utils/calendarDisplay";


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
  handleDragStart: (e: React.DragEvent, task: Task, originCleanerId?: string) => void;
  handleDragEnd: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, cleanerId: string, cleaners: Cleaner[], timeSlot?: string) => void;
  handleHeaderScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleBodyScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleTaskClick: (task: Task) => void;
  handleCreateTask: (taskData: Omit<Task, 'id'>) => Promise<void>;
  handleBatchCreateTasks: (tasksData: Omit<Task, 'id'>[]) => Promise<void>;
  handleUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<boolean | void>;
  handleDeleteTask: (taskId: string) => Promise<boolean | void>;
  handleUnassignTask: (taskId: string) => Promise<boolean | void>;
  handleRemoveCleanerFromTask?: (taskId: string, cleanerId: string, cleanerName?: string) => Promise<boolean | void>;
  onNavigateDate: (direction: 'prev' | 'next') => void;
  onSelectDay: (day: string) => void;
  onConfirm: ConfirmFn;
  /** What the current role may do (calendar module of the role matrix). */
  permissions?: CalendarPermissions;
  validateScheduleChange?: CalendarActionsValue['validateScheduleChange'];
  zoom?: TimelineZoom;
  /** Explains why unassigned tasks still show with the cleaner filter. */
  unassignedNote?: string;
}

export const CalendarContainer = ({
  tasks,
  cleaners,
  currentDate,
  currentView,
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
  handleRemoveCleanerFromTask,
  onNavigateDate,
  onSelectDay,
  onConfirm,
  permissions = FULL_CALENDAR_PERMISSIONS,
  validateScheduleChange,
  zoom = 'normal',
  unassignedNote
}: CalendarContainerProps) => {
  // Note: Mobile cleaner view logic moved to CleaningCalendar component
  // to avoid conditional hooks execution

  // Memoized task filtering for desktop view
  const { assignedTasks, unassignedTasks } = useMemo(() => {
    // Assigned through task_assignments, legacy cleaner_id or legacy cleaner name
    const assigned = tasks.filter(task => isTaskAssigned(task));
    const unassigned = tasks.filter(task => !isTaskAssigned(task));
    return { assignedTasks: assigned, unassignedTasks: unassigned };
  }, [tasks]);

  // Assignments already come with the task query. Reuse them instead of
  // blocking calendar rendering on a second request for the same rows.
  const assignmentsMap = useMemo(
    () => buildTaskAssignmentsMap(assignedTasks),
    [assignedTasks],
  );

  // Fetch absence status for all cleaners on current date
  const cleanerIds = useMemo(() => cleaners.map(c => c.id), [cleaners]);
  const { data: absenceStatus } = useWorkersAbsenceStatus(cleanerIds, currentDate, {
    canSeeAbsenceDetails: permissions.canSeeAbsenceDetails,
  });

  // Workload data for all cleaners (viewed week)
  const { workloadMap } = useCalendarWorkload(currentDate);

  const isMultiDay = isMultiDayView(currentView);
  const visibleDays = useMemo(() => getVisibleDays(currentDate, currentView), [currentDate, currentView]);
  // The week view starts on Monday, not on the anchor date.
  const rangeStartDate = useMemo(() => civilDateToLocalDate(visibleDays[0]), [visibleDays]);

  // Cleaners fully unavailable across the visible range (full-day absence or fixed day off)
  const { unavailableIds } = useUnavailableCleaners(cleaners, rangeStartDate, currentView, {
    canSeeAbsenceDetails: permissions.canSeeAbsenceDetails,
  });

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

  // Cleaners without availability configured for the day shown: unknown, not free.
  const unconfiguredCleanerIds = useMemo(
    () => new Set(visibleCleaners.filter(c => !getCleanerAvailabilityForDay(c.id, currentDate, availability)).map(c => c.id)),
    [visibleCleaners, currentDate, availability],
  );

  // Timeline range: 06:00–22:30 by default, widened to show every task of the day.
  const currentDayStr = formatMadridDate(currentDate);
  const scale = useMemo<TimelineScale>(() => {
    const bounds = getTimelineBounds(assignedTasks.filter(t => t.date === currentDayStr));
    return { ...bounds, slotWidth: ZOOM_SLOT_WIDTH[zoom] };
  }, [assignedTasks, currentDayStr, zoom]);
  const dayTimeSlots = useMemo(() => buildTimeSlots(scale), [scale]);

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

  // Slot occupation check, excluding the task being dragged. Indexed per
  // cleaner and stable between renders so the grid rows can stay memoized.
  const checkTimeSlotOccupied = useMemo(
    () => buildTimeSlotOccupancy(assignedTasks, cleaners, dragState.draggedTask?.id, assignmentsMap),
    [assignedTasks, cleaners, dragState.draggedTask?.id, assignmentsMap]
  );

  // Quick actions from EnhancedTaskCard context menu (decoupled via window events)
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleBlockedDrop = useCallback((reason: string) => {
    toast({ title: 'No se puede asignar en esta franja', description: reason, variant: 'destructive' });
  }, [toast]);

  const handleOverlapTaskSelect = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) handleTaskClick(task);
  }, [tasks, handleTaskClick]);

  useEffect(() => {
    const findTask = (id: string) => tasks.find(t => t.id === id);

    const optimisticRemove = (id: string) => {
      queryClient.setQueriesData(
        { predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === 'tasks' },
        (old: Task[] | undefined) => Array.isArray(old) ? old.filter(t => t.id !== id) : old
      );
    };

    const handleDuplicate = async (e: Event) => {
      if (!permissions.canCreate) return;
      const { taskId } = (e as CustomEvent).detail || {};
      const t = findTask(taskId);
      if (!t) return;
      try {
        // The copy is created without anyone assigned (no assignment notices).
        await taskStorageService.createTask(buildUnassignedDuplicate(t) as Omit<Task, 'id'>);
        queryClient.invalidateQueries({
          predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === 'tasks',
        });
        toast({ title: 'Tarea duplicada', description: 'La copia está en "Tareas sin asignar".' });
      } catch (err: unknown) {
        toast({ title: 'Error', description: getErrorMessage(err, 'No se pudo duplicar.'), variant: 'destructive' });
      }
    };

    const handleUnassign = async (e: Event) => {
      if (!permissions.canEdit) return;
      const { taskId, cleanerId, cleanerName, all } = (e as CustomEvent).detail || {};
      const t = findTask(taskId);
      if (!t) return;

      try {
        if ((t as RecurringCalendarTask).isRecurringInstance) {
          const confirmed = await onConfirm({
            title: 'Desasignar ocurrencia',
            description: `Se creará una tarea individual sin asignar para ${t.property} en esta fecha.`,
            confirmLabel: 'Desasignar',
          });
          if (!confirmed) return;
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

        // Only this person of a shared task: the rest of the team stays.
        if (!all && cleanerId && handleRemoveCleanerFromTask) {
          const confirmed = await onConfirm({
            title: `Quitar a ${cleanerName || 'la trabajadora'}`,
            description: `${cleanerName || 'Esta trabajadora'} dejará de estar en ${t.property}. El resto del equipo se mantiene.`,
            confirmLabel: 'Quitar',
          });
          if (!confirmed) return;
          await handleRemoveCleanerFromTask(taskId, cleanerId, cleanerName);
          return;
        }

        const confirmed = await onConfirm({
          title: 'Desasignar tarea',
          description: `${t.property} quedará sin nadie asignado y pasará a "Tareas sin asignar".`,
          confirmLabel: 'Desasignar',
        });
        if (!confirmed) return;
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
      if (!permissions.canDelete) return;
      const { taskId } = (e as CustomEvent).detail || {};
      const confirmed = await onConfirm({
        title: 'Eliminar tarea',
        description: '¿Eliminar esta tarea? Esta acción no se puede deshacer.',
        confirmLabel: 'Eliminar',
        destructive: true,
      });
      if (!confirmed) return;
      optimisticRemove(taskId);
      // The success message waits for the real result; on failure the
      // mutation shows the error and the task comes back.
      const deleted = await handleDeleteTask(taskId);
      if (deleted === false) {
        queryClient.invalidateQueries({
          predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === 'tasks',
        });
        return;
      }
      toast({ title: 'Tarea eliminada', description: 'La tarea se ha eliminado.' });
    };

    window.addEventListener('task:duplicate', handleDuplicate);
    window.addEventListener('task:unassign', handleUnassign);
    window.addEventListener('task:delete', handleDelete);
    return () => {
      window.removeEventListener('task:duplicate', handleDuplicate);
      window.removeEventListener('task:unassign', handleUnassign);
      window.removeEventListener('task:delete', handleDelete);
    };
  }, [tasks, queryClient, toast, handleUnassignTask, handleRemoveCleanerFromTask, handleDeleteTask, onConfirm, permissions]);

  const actionsValue = useMemo<CalendarActionsValue>(
    () => ({ permissions, validateScheduleChange, scale }),
    [permissions, validateScheduleChange, scale],
  );

  const isEmptyDay = !isMultiDay && tasks.filter(t => t.date === currentDayStr).length === 0;

  return (
    <CalendarActionsProvider value={actionsValue}>
      {/* Overlap Alerts - Compact collapsible banner */}
      <OverlapAlertsBanner
        overlapsByCleanerMap={overlapsByCleanerMap}
        cleaners={cleaners}
        showDate={isMultiDay}
        resetKey={visibleDays.join(',')}
        onTaskSelect={handleOverlapTaskSelect}
      />

      {isEmptyDay && (
        <div className="mb-2 rounded-md border border-dashed border-border bg-card px-3 py-2 text-sm text-muted-foreground" role="status">
          No hay tareas para este día con los filtros actuales.
        </div>
      )}

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
              canDrag={permissions.canEdit}
              note={unassignedNote}
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
            timeSlots={dayTimeSlots}
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
            scale={scale}
            onBlockedDrop={handleBlockedDrop}
            unconfiguredCleanerIds={unconfiguredCleanerIds}
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
        permissions={permissions}
      />
    </CalendarActionsProvider>
  );
};
