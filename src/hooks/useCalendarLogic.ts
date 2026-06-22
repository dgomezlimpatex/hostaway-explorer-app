
import { useState, useMemo, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCalendarData } from "@/hooks/useCalendarData";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import { useAllCleanersAvailability } from "@/hooks/useAllCleanersAvailability";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@/types/calendar";
import { isCleanerAvailableAtTime } from "@/utils/availabilityUtils";

import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ABSENCE_TYPE_LABELS } from "@/types/workerAbsence";
import { buildExtraordinaryTask, type ExtraordinaryTaskFormData } from "@/services/extraordinaryTaskBuilder";
import { materializeRecurringTaskInstance } from "@/services/recurringTaskInstanceService";

// Helper function to check time overlap
const toMin = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};
const fromMin = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};
const timeRangesOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
  const s1 = toMin(start1), e1 = toMin(end1);
  const s2 = toMin(start2), e2 = toMin(end2);
  return s1 < e2 && e1 > s2;
};

export const useCalendarLogic = () => {
  const {
    tasks,
    cleaners,
    currentDate,
    currentView,
    isLoading,
    setCurrentDate,
    setCurrentView,
    navigateDate,
    goToToday,
    updateTask,
    assignTask,
    assignTaskWithSchedule,
    unassignTask,
    createTask,
    deleteTask,
    deleteAllTasks
  } = useCalendarData();

  const { data: availability = [], isInitialLoading: isInitialLoadingAvailability } = useAllCleanersAvailability();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBatchCreateModalOpen, setIsBatchCreateModalOpen] = useState(false);
  const [isExtraordinaryServiceModalOpen, setIsExtraordinaryServiceModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  
  // Refs for scroll synchronization
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);

  // Memoized time slots generation
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 6; hour <= 22; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 22) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }, []);

  // Enhanced task assignment handler with availability and overlap check
  const handleTaskAssign = useCallback(async (taskId: string, cleanerId: string, cleaners: any[], timeSlot?: string) => {
    console.log('useCalendarLogic - handleTaskAssign called with:', { taskId, cleanerId, cleaners, timeSlot });
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      toast({
        title: "Error",
        description: "No se pudo encontrar la tarea.",
        variant: "destructive",
      });
      return;
    }

    // Create a date object for the task
    const taskDate = new Date(task.date);
    const startTime = timeSlot || task.startTime;
    
    // Calculate end time based on original duration if timeSlot is provided
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
      let newEndHour = Math.floor(newEndTotalMinutes / 60);
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

    // Check for worker absence conflicts
    const taskDateStr = format(taskDate, 'yyyy-MM-dd');
    const dayOfWeek = taskDate.getDay();

    // Run all 3 availability queries in PARALLEL (was sequential = ~600ms, now ~200ms)
    const [fixedDayOffRes, absencesRes, maintenanceRes] = await Promise.all([
      supabase
        .from('worker_fixed_days_off')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('worker_absences')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .lte('start_date', taskDateStr)
        .gte('end_date', taskDateStr),
      supabase
        .from('worker_maintenance_cleanings')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .eq('is_active', true)
        .contains('days_of_week', [dayOfWeek]),
    ]);

    const fixedDayOff = fixedDayOffRes.data;
    const absences = absencesRes.data;
    const maintenanceCleanings = maintenanceRes.data;

    if (fixedDayOff) {
      const confirmed = window.confirm(
        `⚠️ DÍA LIBRE FIJO\n\n` +
        `El trabajador tiene este día marcado como día libre fijo.\n\n` +
        `¿Deseas asignar la tarea de todas formas?`
      );
      if (!confirmed) return;
    }

    const fullDayAbsence = absences?.find(a => !a.start_time || !a.end_time);
    if (fullDayAbsence) {
      const absenceLabel = ABSENCE_TYPE_LABELS[fullDayAbsence.absence_type as keyof typeof ABSENCE_TYPE_LABELS] || fullDayAbsence.absence_type;
      const confirmed = window.confirm(
        `⚠️ AUSENCIA DEL TRABAJADOR\n\n` +
        `El trabajador tiene registrada una ausencia: ${absenceLabel}\n\n` +
        `¿Deseas asignar la tarea de todas formas?`
      );
      if (!confirmed) return;
    }

    // Check hourly absences for time overlap
    const hourlyAbsences = absences?.filter(a => a.start_time && a.end_time) || [];
    for (const absence of hourlyAbsences) {
      if (timeRangesOverlap(startTime, endTime, absence.start_time!, absence.end_time!)) {
        const absenceLabel = ABSENCE_TYPE_LABELS[absence.absence_type as keyof typeof ABSENCE_TYPE_LABELS] || absence.absence_type;
        const confirmed = window.confirm(
          `⚠️ CONFLICTO DE HORARIO\n\n` +
          `El trabajador tiene: ${absenceLabel}\n` +
          `Horario: ${absence.start_time?.slice(0,5)} - ${absence.end_time?.slice(0,5)}\n\n` +
          `¿Deseas asignar la tarea de todas formas?`
        );
        if (!confirmed) return;
        break;
      }
    }

    // Check maintenance cleanings for time overlap
    for (const maintenance of maintenanceCleanings || []) {
      if (timeRangesOverlap(startTime, endTime, maintenance.start_time, maintenance.end_time)) {
        const confirmed = window.confirm(
          `⚠️ LIMPIEZA DE MANTENIMIENTO\n\n` +
          `El trabajador tiene: ${maintenance.location_name}\n` +
          `Horario: ${maintenance.start_time.slice(0,5)} - ${maintenance.end_time.slice(0,5)}\n\n` +
          `¿Deseas asignar la tarea de todas formas?`
        );
        if (!confirmed) return;
        break;
      }
    }

    // Compute cascade: shift forward any task of the same cleaner on the same day
    // that overlaps with the dropped task or with the chain of shifted tasks.
    const cleanerObjForCascade = cleaners.find((c: any) => c.id === cleanerId);
    const cleanerNameForCascade = cleanerObjForCascade?.name || '';

    const sameDayCleanerTasks = tasks
      .filter(t =>
        t.id !== taskId &&
        t.date === task.date &&
        ((t as any).cleanerId === cleanerId || t.cleaner === cleanerNameForCascade)
      )
      .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));

    const displaced: Array<{
      taskId: string;
      property: string;
      address?: string;
      type?: string;
      oldStartTime: string;
      oldEndTime: string;
      newStartTime: string;
      newEndTime: string;
    }> = [];

    let cursorEnd = toMin(endTime);
    const MAX_END = 23 * 60 + 59;

    // Helper: count assigned workers (multi-worker tasks split duration evenly)
    const getAssignedCount = (t: any): number => {
      if (Array.isArray(t.assignments) && t.assignments.length > 0) return t.assignments.length;
      if (typeof t.cleaner === 'string' && t.cleaner.includes(',')) {
        return t.cleaner.split(',').map((s: string) => s.trim()).filter(Boolean).length;
      }
      return 1;
    };

    for (const b of sameDayCleanerTasks) {
      const bStart = toMin(b.startTime);
      const bEnd = toMin(b.endTime);
      // Effective per-worker end for cascade: if multi-worker, divide duration
      const bAssigned = getAssignedCount(b);
      const fullDur = Math.max(bEnd - bStart, 0);
      const effectiveDur = bAssigned > 1 ? Math.max(15, Math.round(fullDur / bAssigned)) : fullDur;
      const bEffectiveEnd = bStart + effectiveDur;

      if (bStart >= cursorEnd) {
        break; // no further overlap, stop cascade
      }
      // If the existing task's effective (per-worker) end is already before our cursor,
      // it doesn't actually conflict with the dropped task — skip it.
      if (bEffectiveEnd <= cursorEnd && bStart < cursorEnd) {
        // overlap is only against the unused portion of a multi-worker block; skip
        continue;
      }
      const dur = effectiveDur;
      const newStart = cursorEnd;
      const newEnd = newStart + dur;
      if (newEnd > MAX_END) {
        toast({
          title: "No se puede reorganizar",
          description: `Mover la tarea desplazaría "${b.property}" más allá de las 23:59.`,
          variant: "destructive",
        });
        return;
      }
      displaced.push({
        taskId: b.id,
        property: b.property,
        address: (b as any).address,
        type: (b as any).type,
        oldStartTime: b.startTime,
        oldEndTime: b.endTime,
        newStartTime: fromMin(newStart),
        newEndTime: fromMin(newEnd),
      });
      cursorEnd = newEnd;
    }

    // Check availability for the dropped task itself
    const availabilityCheck = isCleanerAvailableAtTime(
      cleanerId,
      taskDate,
      startTime,
      endTime,
      availability
    );

    if (!availabilityCheck.available) {
      toast({
        title: "Trabajador no disponible",
        description: availabilityCheck.reason || "El trabajador no está disponible en este horario.",
        variant: "destructive",
      });
      return;
    }

    try {
      const cleanerObj = cleaners.find((c: any) => c.id === cleanerId);
      const cleanerName = cleanerObj?.name || '';

      if ((task as any).isRecurringInstance) {
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
      } else {
        // SINGLE round-trip: assign + reschedule in one DB call (optimistic UI immediate)
        assignTaskWithSchedule({
          taskId,
          cleanerId,
          cleanerName,
          startTime: timeSlot ? timeSlot : undefined,
          endTime: timeSlot ? endTime : undefined,
        });
      }

      // Apply cascading reschedules to the displaced tasks
      if (displaced.length > 0) {
        await Promise.all(
          displaced.map(d =>
            supabase
              .from('tasks')
              .update({ start_time: d.newStartTime, end_time: d.newEndTime })
              .eq('id', d.taskId)
          )
        );

        // Send a single consolidated email to the cleaner
        const cleanerEmail = (cleanerObj as any)?.email;
        if (cleanerEmail) {
          supabase.functions
            .invoke('send-task-reschedule-batch-email', {
              body: {
                cleanerEmail,
                cleanerName,
                date: task.date,
                insertedTask: {
                  property: task.property,
                  address: (task as any).address,
                  type: (task as any).type,
                  startTime: startTime,
                  endTime: endTime,
                },
                changes: displaced,
              },
            })
            .catch(err => console.error('Error sending batch reschedule email:', err));
        } else {
          console.log('Cleaner has no email, skipping batch reschedule email');
        }
      }

      toast({
        title: "Tarea asignada",
        description: displaced.length > 0
          ? `Tarea asignada. ${displaced.length} tarea(s) desplazada(s) automáticamente.`
          : (timeSlot
            ? `La tarea se ha asignado correctamente para las ${timeSlot}.`
            : "La tarea se ha asignado correctamente."),
      });
    } catch (error) {
      console.error('Error assigning task:', error);
      toast({
        title: "Error",
        description: "No se pudo asignar la tarea.",
        variant: "destructive",
      });
    }
  }, [tasks, assignTaskWithSchedule, toast, availability, cleaners, queryClient]);

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
    console.log('🔵 useCalendarLogic - handleNewTask called, opening modal');
    setIsCreateModalOpen(true);
  }, []);

  const handleNewExtraordinaryService = useCallback(() => {
    console.log('🔵 useCalendarLogic - handleNewExtraordinaryService called, opening modal');
    setIsExtraordinaryServiceModalOpen(true);
  }, []);

  const handleNewBatchTask = useCallback(() => {
    console.log('🔵 useCalendarLogic - handleNewBatchTask called, opening modal');
    setIsBatchCreateModalOpen(true);
  }, []);

  const handleCreateTask = useCallback(async (taskData: Omit<Task, 'id'>) => {
    console.log('🔵 useCalendarLogic - handleCreateTask called with:', taskData);
    try {
      const result = await createTask(taskData);
      console.log('✅ useCalendarLogic - createTask successful:', result);
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

  const handleCreateExtraordinaryService = useCallback(async (serviceData: ExtraordinaryTaskFormData) => {
    const taskData = buildExtraordinaryTask(serviceData);

    try {
      const result = await createTask(taskData);
      console.log('useCalendarLogic - createExtraordinaryService successful:', result);
      toast({
        title: "Tarea extraordinaria creada",
        description: `"${serviceData.serviceName}" se ha creado correctamente.`,
      });
      setIsExtraordinaryServiceModalOpen(false);
    } catch (error) {
      console.error('useCalendarLogic - createExtraordinaryService error:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la tarea extraordinaria.",
        variant: "destructive",
      });
    }
  }, [createTask, toast]);

  const handleBatchCreateTasks = useCallback(async (tasksData: Omit<Task, 'id'>[]) => {
    console.log('🔵 useCalendarLogic - handleBatchCreateTasks called with:', tasksData.length, 'tasks');
    try {
      // Create all tasks sequentially
      for (const taskData of tasksData) {
        await createTask(taskData);
      }
      
      toast({
        title: "Tareas creadas",
        description: `Se han creado ${tasksData.length} tareas correctamente.`,
      });
      setIsBatchCreateModalOpen(false);
    } catch (error) {
      console.error('❌ useCalendarLogic - handleBatchCreateTasks error:', error);
      toast({
        title: "Error",
        description: "No se pudieron crear todas las tareas.",
        variant: "destructive",
      });
    }
  }, [createTask, toast]);

  const handleTaskClick = useCallback((task: Task) => {
    // Para mobile cleaners, esto se maneja en el componente directamente
    // Para desktop, abre el modal de edición
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  }, []);

  const handleUpdateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    try {
      await updateTask({ taskId, updates });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar la tarea.",
        variant: "destructive",
      });
    }
  }, [updateTask, toast]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      await deleteTask(taskId);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la tarea.",
        variant: "destructive",
      });
    }
  }, [deleteTask, toast]);

  const handleDeleteAllTasks = useCallback(async () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar TODAS las tareas? Esta acción no se puede deshacer.')) {
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
  }, [deleteAllTasks, toast]);

  const handleUnassignTask = useCallback(async (taskId: string) => {
    try {
      await unassignTask(taskId);
    } catch (error) {
      console.error('Error unassigning task:', error);
      toast({
        title: "Error",
        description: "No se pudo desasignar la tarea.",
        variant: "destructive",
      });
    }
  }, [unassignTask, toast]);

  return {
    // Data
    tasks,
    cleaners,
    currentDate,
    currentView,
    isLoading: isLoading || isInitialLoadingAvailability,
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
    isExtraordinaryServiceModalOpen,
    setIsExtraordinaryServiceModalOpen,
    selectedTask,
    isTaskModalOpen,
    setIsTaskModalOpen,
    
    // Drag and drop
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    
    // Memoized actions
    setCurrentDate,
    setCurrentView,
    navigateDate,
    goToToday,
    handleNewTask,
    handleNewBatchTask,
    handleNewExtraordinaryService,
    handleCreateTask,
    handleBatchCreateTasks,
    handleCreateExtraordinaryService,
    handleTaskClick,
    handleUpdateTask,
    handleDeleteTask,
    handleDeleteAllTasks,
    handleUnassignTask
  };
};
