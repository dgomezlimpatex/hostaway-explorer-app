
import { useState, useMemo, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCalendarData } from "@/hooks/useCalendarData";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import { useAllCleanersAvailability } from "@/hooks/useAllCleanersAvailability";
import { useToast } from "@/hooks/use-toast";
import { Cleaner, Task } from "@/types/calendar";
import { getCleanerAvailabilityState } from "@/utils/availabilityUtils";

import { supabase } from "@/integrations/supabase/client";
import { materializeRecurringTaskInstance } from "@/services/recurringTaskInstanceService";
import {
  computeCascadeShifts,
  persistCascadeShiftsSettled,
  revertCascadeShifts,
  type CascadeShift,
} from "@/utils/calendarCascade";
import { useConfirmDialog } from "@/components/calendar/useConfirmDialog";
import { createTasksOneByOne, describeBatchFailure } from "@/utils/batchTaskCreation";
import { civilDateToLocalDate } from "@/components/calendar/utils/multiDayCalendar";
import { buildTimeSlots, DEFAULT_SCALE } from "@/components/calendar/utils/timelineScale";
import { resolveDropAssignment } from "@/utils/calendarSharedMove";
import { fetchCleanerDayConflicts, findCleanerTaskOverlaps } from "@/utils/calendarScheduleConflicts";
import { getTaskAssignedCleanerIds } from "@/utils/taskAssignments";
import { getEffectiveTaskEndTime } from "@/utils/taskPositioning";
import { filterTasksByQueryRange } from "@/utils/taskQueryRange";

type CalendarTask = Task & { isRecurringInstance?: boolean };

const STATUS_LABELS: Record<string, string> = {
  'in-progress': 'en curso',
  completed: 'finalizada',
};

const describeShift = (shift: CascadeShift) =>
  `• ${shift.property}: ${shift.oldStartTime.slice(0, 5)}–${shift.oldEndTime.slice(0, 5)} → ${shift.newStartTime}–${shift.newEndTime}`;

/**
 * `canSeeAbsenceDetails`: without it, warnings name a medical leave as a
 * generic absence (supervision, Dani 20/10/2026).
 */
export const useCalendarLogic = ({ canSeeAbsenceDetails = true }: { canSeeAbsenceDetails?: boolean } = {}) => {
  const {
    tasks,
    cleaners,
    currentDate,
    currentView,
    isLoading,
    isTasksError,
    refetchTasks,
    tasksUpdatedAt,
    setCurrentDate,
    setCurrentView,
    navigateDate,
    goToToday,
    updateTaskAsync,
    assignTaskWithSchedule,
    reassignTaskKeepingCoworkers,
    removeCleanerFromTask,
    unassignTaskAsync,
    createTask,
    deleteTaskAsync,
    deleteAllTasks
  } = useCalendarData();

  const { data: availability = [], isInitialLoading: isInitialLoadingAvailability } = useAllCleanersAvailability();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // In-app confirmations (window.confirm blocks the page and cannot be styled).
  const { confirm, choose, dialog: confirmDialog } = useConfirmDialog();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBatchCreateModalOpen, setIsBatchCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Refs for scroll synchronization
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);

  // Default 06:00–22:30 slots; the day grid widens them to show earlier or later tasks.
  const timeSlots = useMemo(() => buildTimeSlots(DEFAULT_SCALE), []);

  /**
   * Drop of a task block on a cleaner row (Día) or a cleaner/day cell
   * (3 días/Semana). `originCleanerId` is the row the block came from: for
   * shared tasks only that person is replaced (agreed with Dani).
   */
  const handleTaskAssign = useCallback(async (taskId: string, cleanerId: string, currentCleaners: Cleaner[], timeSlot?: string, originCleanerId?: string) => {

    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      toast({
        title: "Error",
        description: "No se pudo encontrar la tarea.",
        variant: "destructive",
      });
      return;
    }

    // Civil date in Europe/Madrid: local noon gives the right weekday on any device.
    const taskDate = civilDateToLocalDate(task.date);
    const startTime = timeSlot || task.startTime;

    // Calculate end time based on original duration if timeSlot is provided.
    // `task` is the stored task: for a shared task this is the whole service
    // window, not the per-person block drawn in the row.
    let endTime = task.endTime;
    if (timeSlot) {
      const [startHour, startMinute] = task.startTime.split(':').map(Number);
      const [endHour, endMinute] = task.endTime.split(':').map(Number);

      // Validate that we have valid time values (handle cases like 24:00 or invalid times)
      let originalDurationMinutes: number;
      if (isNaN(startHour) || isNaN(endHour) || startHour >= 24 || endHour > 24) {
        // Fallback to task duration or default 2 hours
        originalDurationMinutes = task.duration || 120;
        console.warn('Invalid task times detected, using duration fallback:', originalDurationMinutes);
      } else {
        originalDurationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
        // Handle negative duration (e.g., end time before start time)
        if (originalDurationMinutes <= 0) {
          originalDurationMinutes = task.duration || 120;
          console.warn('Invalid duration calculated, using fallback:', originalDurationMinutes);
        }
      }

      const [newStartHour, newStartMinute] = timeSlot.split(':').map(Number);
      const newEndTotalMinutes = (newStartHour * 60 + newStartMinute) + originalDurationMinutes;
      const newEndHour = Math.floor(newEndTotalMinutes / 60);
      const newEndMinute = newEndTotalMinutes % 60;

      // Clamp end time to 23:59 max to avoid invalid times like 24:00 or 25:00
      if (newEndHour >= 24) {
        endTime = '23:59';
        toast({
          title: "Horario ajustado",
          description: "La hora de fin se ha ajustado a 23:59 para mantenerla dentro del día.",
          variant: "default",
        });
      } else {
        endTime = `${newEndHour.toString().padStart(2, '0')}:${newEndMinute.toString().padStart(2, '0')}`;
      }
    }

    const previousCleanerIds = getTaskAssignedCleanerIds(task);
    const assignment = resolveDropAssignment(previousCleanerIds, originCleanerId, cleanerId);
    const scheduleChanged = startTime !== task.startTime || endTime !== task.endTime;
    if (assignment.kind === 'keep-team' && !scheduleChanged) {
      // Same people, same time: nothing to save and nobody to notify.
      return;
    }

    // Absences, fixed day off and maintenance of the target cleaner (reads only).
    const conflicts = await fetchCleanerDayConflicts(supabase, cleanerId, task.date, startTime, endTime, { canSeeAbsenceDetails });
    for (const conflict of conflicts) {
      const confirmed = await confirm({
        title: conflict.title,
        description: `${conflict.detail}\n\n¿Deseas asignar la tarea de todas formas?`,
        confirmLabel: "Asignar igualmente",
      });
      if (!confirmed) return;
    }

    // Availability: a configured day off or hours outside the configuration
    // block the drop; a missing configuration is unknown and only warns.
    const availabilityCheck = getCleanerAvailabilityState(cleanerId, taskDate, startTime, endTime, availability);
    if (availabilityCheck.state === 'unavailable') {
      toast({
        title: "Trabajador no disponible",
        description: availabilityCheck.reason || "El trabajador no está disponible en este horario.",
        variant: "destructive",
      });
      return;
    }

    // Compute cascade: shift forward any task of the same cleaner on the same day
    // that overlaps with the dropped task or with the chain of shifted tasks.
    const cleanerObj = currentCleaners.find((cleaner) => cleaner.id === cleanerId);
    const cleanerName = cleanerObj?.name || '';

    const cascade = computeCascadeShifts(tasks, {
      taskId,
      date: task.date,
      startTime,
      endTime,
      cleanerId,
      cleanerName,
    });
    if (!cascade.ok) {
      toast({
        title: "No se puede reorganizar",
        description: `Mover la tarea desplazaría "${cascade.blockedBy}" más allá de las 23:59. No se ha guardado nada.`,
        variant: "destructive",
      });
      return;
    }

    // Preview the whole reorganisation before saving anything (CAL-03).
    let displaced: CascadeShift[] = cascade.shifts;
    if (cascade.shifts.length > 0 || cascade.fixed.length > 0) {
      const lines: string[] = [];
      if (cascade.shifts.length > 0) {
        lines.push(`Se moverán ${cascade.shifts.length} tarea(s) de ${cleanerName || 'esta trabajadora'}:`);
        lines.push(...cascade.shifts.map(describeShift));
        lines.push('Las tareas compartidas conservan toda su ventana de servicio.');
      }
      if (cascade.fixed.length > 0) {
        if (lines.length) lines.push('');
        lines.push('No se mueven (ya iniciadas o finalizadas); el solape quedará visible:');
        lines.push(...cascade.fixed.map((f) => `• ${f.property} ${f.startTime.slice(0, 5)}–${f.endTime.slice(0, 5)} (${STATUS_LABELS[f.status] || f.status})`));
      }
      if (cascade.shifts.length > 0 && cleanerObj?.email) {
        lines.push('', 'Al desplazar se enviará a la trabajadora un único aviso con los cambios.');
      }

      if (cascade.shifts.length > 0) {
        const choice = await choose({
          title: `Reorganizar el día`,
          description: lines.join('\n'),
          confirmLabel: 'Desplazar y asignar',
          secondaryLabel: 'Asignar sin desplazar',
        });
        if (choice === 'cancel') return;
        if (choice === 'secondary') displaced = [];
      } else {
        const confirmed = await confirm({
          title: 'Quedará un solape',
          description: lines.join('\n'),
          confirmLabel: 'Asignar igualmente',
        });
        if (!confirmed) return;
      }
    }

    // 1) Assignment + schedule of the dropped task (canonical service, reverts itself on failure).
    try {
      if ((task as CalendarTask).isRecurringInstance) {
        await materializeRecurringTaskInstance(task, {
          cleaner: cleanerName,
          cleanerId,
          startTime,
          endTime,
          status: 'pending',
        });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['recurring-task-executions'] }),
          queryClient.invalidateQueries({ queryKey: ['recurring-tasks-for-calendar'] }),
          queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        ]);
      } else if (assignment.kind === 'assign') {
        // SINGLE round-trip: assign + reschedule in one DB call (optimistic UI immediate)
        await assignTaskWithSchedule({
          taskId,
          cleanerId,
          cleanerName,
          startTime: timeSlot ? timeSlot : undefined,
          endTime: timeSlot ? endTime : undefined,
        });
      } else {
        const nameById = new Map(currentCleaners.map((cleaner) => [cleaner.id, cleaner.name]));
        (task.assignments || []).forEach((a) => { if (a.cleaner_id && a.cleaner_name && !nameById.has(a.cleaner_id)) nameById.set(a.cleaner_id, a.cleaner_name); });
        await reassignTaskKeepingCoworkers({
          taskId,
          replacedCleanerId: assignment.replacedCleanerId,
          cleanerId,
          cleanerName,
          startTime: timeSlot ? timeSlot : undefined,
          endTime: timeSlot ? endTime : undefined,
          nextTeam: assignment.nextCleanerIds.map((id) => ({ id, name: nameById.get(id) || '' })),
        });
      }
    } catch (error) {
      // The mutation already showed the error and reloaded the data.
      console.error('Error assigning task:', error);
      return;
    }

    // 2) Cascade shifts, with a visible result per task.
    if (displaced.length > 0) {
      const persistence = {
        updateTaskTimes: async (id: string, newStartTime: string, newEndTime: string) => {
          const { data, error } = await supabase
              .from('tasks')
              .update({ start_time: newStartTime, end_time: newEndTime })
              .eq('id', id)
              .select('id');
          if (error) throw error;
          return data?.length ?? 0;
        },
        // Virtual recurring occurrences have no row yet: create it with the new times.
        materializeRecurring: (recurringTask: Task, newStartTime: string, newEndTime: string) =>
          materializeRecurringTaskInstance(recurringTask, {
            cleaner: recurringTask.cleaner || cleanerName,
            cleanerId: recurringTask.cleanerId || cleanerId,
            startTime: newStartTime,
            endTime: newEndTime,
          }),
      };
      const result = await persistCascadeShiftsSettled(displaced, tasks, persistence);

      if (displaced.some(d => (tasks.find(t => t.id === d.taskId) as CalendarTask | undefined)?.isRecurringInstance)) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['recurring-task-executions'] }),
          queryClient.invalidateQueries({ queryKey: ['recurring-tasks-for-calendar'] }),
        ]);
      }
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });

      if (result.failed.length > 0) {
        // Put back what was already moved so the day is not left half reorganised.
        const { reverted, notReverted } = await revertCascadeShifts(result.saved, tasks, persistence);
        await queryClient.invalidateQueries({ queryKey: ['tasks'] });
        const parts = [
          `La tarea se asignó, pero no se pudieron mover: ${result.failed.map(f => f.shift.property).join(', ')}.`,
          reverted.length ? `Se han devuelto a su hora: ${reverted.map(s => s.property).join(', ')}.` : '',
          notReverted.length ? `Revisa a mano: ${notReverted.map(s => s.property).join(', ')}.` : '',
          'No se ha enviado el aviso de cambios.',
        ].filter(Boolean);
        toast({ title: "Reorganización incompleta", description: parts.join(' '), variant: "destructive" });
        return;
      }

      // Send a single consolidated email to the cleaner
      const cleanerEmail = cleanerObj?.email;
      if (cleanerEmail) {
        supabase.functions
          .invoke('send-task-reschedule-batch-email', {
            body: {
              cleanerEmail,
              cleanerName,
              date: task.date,
              insertedTask: {
                property: task.property,
                address: task.address,
                type: task.type,
                startTime: startTime,
                endTime: endTime,
              },
              changes: displaced,
            },
          })
          .catch(err => console.error('Error sending batch reschedule email:', err));
      }
    }

    const keptCoworkers = assignment.kind === 'replace-origin' ? assignment.nextCleanerIds.length - 1 : 0;
    const details = [
      displaced.length > 0
        ? `${displaced.length} tarea(s) desplazada(s).`
        : (timeSlot ? `Nuevo horario: ${startTime}–${endTime}.` : ''),
      assignment.kind === 'keep-team' && previousCleanerIds.length > 1 ? 'Se mantiene todo el equipo.' : '',
      keptCoworkers > 0 ? `Se mantienen ${keptCoworkers} compañera(s).` : '',
      availabilityCheck.state === 'unknown' ? `${availabilityCheck.reason}: comprueba que puede trabajar a esa hora.` : '',
    ].filter(Boolean);
    toast({
      title: assignment.kind === 'keep-team' ? "Horario actualizado" : "Tarea asignada",
      description: details.join(' ') || "La tarea se ha asignado correctamente.",
    });
  }, [tasks, assignTaskWithSchedule, reassignTaskKeepingCoworkers, toast, availability, queryClient, confirm, choose, canSeeAbsenceDetails]);

  /**
   * Same checks as the drop for quick actions that change the schedule of an
   * assigned task (resize, duration, move to another day). Resolves to true
   * when there is nothing to warn about or the person confirms.
   */
  const validateScheduleChange = useCallback(async (
    task: Task,
    next: { date: string; startTime: string; endTime: string },
  ): Promise<boolean> => {
    const cleanerIds = getTaskAssignedCleanerIds(task);
    if (cleanerIds.length === 0) return true;

    const loadedDays = new Set(filterTasksByQueryRange(tasks, currentDate, currentView).map(t => t.date));
    loadedDays.add(task.date);
    const nextTask = { ...task, ...next };
    const perPersonEnd = getEffectiveTaskEndTime(nextTask);
    const messages: string[] = [];

    try {
      for (const id of cleanerIds) {
        const cleaner = cleaners.find(c => c.id === id) || { id, name: task.assignments?.find(a => a.cleaner_id === id)?.cleaner_name };
        const name = cleaner.name || 'Trabajadora';
        const overlaps = findCleanerTaskOverlaps(tasks, cleaner, next.date, next.startTime, perPersonEnd, task.id);
        overlaps.forEach(o => messages.push(`• ${name}: se solapa con ${o.property} (${o.startTime.slice(0, 5)}–${o.endTime.slice(0, 5)})`));
        const dayConflicts = await fetchCleanerDayConflicts(supabase, id, next.date, next.startTime, perPersonEnd, { canSeeAbsenceDetails });
        dayConflicts.forEach(c => messages.push(`• ${name}: ${c.detail.replace(/\n/g, ' · ')}`));
        const availabilityCheck = getCleanerAvailabilityState(id, civilDateToLocalDate(next.date), next.startTime, perPersonEnd, availability);
        if (availabilityCheck.state === 'unavailable') messages.push(`• ${name}: ${availabilityCheck.reason}`);
      }
    } catch (error) {
      console.error('Error checking schedule conflicts:', error);
      messages.push('• No se han podido comprobar ausencias ni disponibilidad.');
    }
    if (!loadedDays.has(next.date)) {
      messages.push('• Ese día no está en pantalla: no se han comprobado solapes con otras tareas.');
    }
    if (messages.length === 0) return true;

    return confirm({
      title: 'Revisa el cambio de horario',
      description: `${messages.join('\n')}\n\nSi guardas, se avisará del nuevo horario a las asignadas. ¿Guardar igualmente?`,
      confirmLabel: 'Guardar igualmente',
    });
  }, [tasks, cleaners, currentDate, currentView, availability, confirm, canSeeAbsenceDetails]);

  // Initialize drag and drop with enhanced handler
  const {
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop
  } = useDragAndDrop(handleTaskAssign);

  // Memoized handlers with useCallback
  const handleNewTask = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const handleNewBatchTask = useCallback(() => {
    setIsBatchCreateModalOpen(true);
  }, []);

  const handleCreateTask = useCallback(async (taskData: Omit<Task, 'id'>) => {
    try {
      await createTask(taskData);
      toast({
        title: "Tarea creada",
        description: "La nueva tarea se ha creado correctamente.",
      });
      setIsCreateModalOpen(false); // Close modal after successful creation
    } catch (error) {
      console.error('❌ useCalendarLogic - createTask error:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la tarea.",
        variant: "destructive",
      });
    }
  }, [createTask, toast]);

  const handleBatchCreateTasks = useCallback(async (tasksData: Omit<Task, 'id'>[]) => {
    const result = await createTasksOneByOne(tasksData, createTask);

    if (result.failed.length === 0) {
      toast({
        title: "Tareas creadas",
        description: `Se han creado ${result.created} tareas correctamente.`,
      });
      setIsBatchCreateModalOpen(false);
      return;
    }

    console.error('❌ useCalendarLogic - handleBatchCreateTasks failed for', result.failed.length, 'tasks');
    toast({
      title: result.created > 0 ? "Creación incompleta" : "Error",
      description: describeBatchFailure(result),
      variant: "destructive",
    });
  }, [createTask, toast]);

  const handleTaskClick = useCallback((task: Task) => {
    // Para mobile cleaners, esto se maneja en el componente directamente
    // Para desktop, abre el modal de edición
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  }, []);

  // The mutations show their own error and restore the cache; these handlers
  // resolve to true only when the change was really saved.
  const handleUpdateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    try {
      await updateTaskAsync({ taskId, updates });
      return true;
    } catch (error) {
      console.error('Error updating task:', error);
      return false;
    }
  }, [updateTaskAsync]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      await deleteTaskAsync(taskId);
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      return false;
    }
  }, [deleteTaskAsync]);

  const handleDeleteAllTasks = useCallback(async () => {
    if (await confirm({
      title: "Eliminar todas las tareas",
      description: "¿Estás seguro de que quieres eliminar TODAS las tareas? Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar todas",
      destructive: true,
    })) {
      try {
        await deleteAllTasks();
        toast({
          title: "Todas las tareas eliminadas",
          description: "Se han eliminado todas las tareas correctamente.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "No se pudieron eliminar las tareas.",
          variant: "destructive",
        });
      }
    }
  }, [deleteAllTasks, toast, confirm]);

  const handleUnassignTask = useCallback(async (taskId: string) => {
    try {
      await unassignTaskAsync(taskId);
      return true;
    } catch (error) {
      console.error('Error unassigning task:', error);
      return false;
    }
  }, [unassignTaskAsync]);

  /** Removes only one person from a shared task (CAL-19). */
  const handleRemoveCleanerFromTask = useCallback(async (taskId: string, cleanerId: string, cleanerName?: string) => {
    try {
      await removeCleanerFromTask({ taskId, cleanerId, cleanerName });
      return true;
    } catch (error) {
      console.error('Error removing cleaner from task:', error);
      return false;
    }
  }, [removeCleanerFromTask]);

  return {
    // Data
    tasks,
    cleaners,
    currentDate,
    currentView,
    isLoading: isLoading || isInitialLoadingAvailability,
    isTasksError,
    refetchTasks,
    tasksUpdatedAt,
    timeSlots,
    availability,

    // Refs
    headerScrollRef,
    bodyScrollRef,

    // Modal states
    isCreateModalOpen,
    setIsCreateModalOpen,
    isBatchCreateModalOpen,
    setIsBatchCreateModalOpen,
    selectedTask,
    isTaskModalOpen,
    setIsTaskModalOpen,

    // Drag and drop
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,

    // Confirmation dialog (render once) and its trigger
    confirm,
    choose,
    confirmDialog,

    // Memoized actions
    setCurrentDate,
    setCurrentView,
    navigateDate,
    goToToday,
    handleNewTask,
    handleNewBatchTask,
    handleCreateTask,
    handleBatchCreateTasks,
    handleTaskClick,
    handleUpdateTask,
    handleDeleteTask,
    handleDeleteAllTasks,
    handleUnassignTask,
    handleRemoveCleanerFromTask,
    validateScheduleChange,
  };
};
