
import { useState, useMemo, useRef, useCallback } from "react";
import { useCalendarData } from "@/hooks/useCalendarData";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import { useAllCleanersAvailability } from "@/hooks/useAllCleanersAvailability";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@/types/calendar";
import { isCleanerAvailableAtTime } from "@/utils/availabilityUtils";

export const useCalendarLogic = () => {
  const {
    tasks,
    cleaners,
    currentDate,
    currentView,
    isLoading,
    setCurrentView,
    navigateDate,
    goToToday,
    updateTask,
    assignTask,
    unassignTask,
    createTask,
    deleteTask,
    deleteAllTasks
  } = useCalendarData();

  const { data: availability = [], isLoading: isLoadingAvailability } = useAllCleanersAvailability();
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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

  // Enhanced task assignment handler with availability check
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
    const endTime = task.endTime;

    // Check availability
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
      // If timeSlot is provided, also update the task's start time
      if (timeSlot) {
        // Calculate end time based on original duration
        const [startHour, startMinute] = task.startTime.split(':').map(Number);
        const [endHour, endMinute] = task.endTime.split(':').map(Number);
        const originalDurationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
        
        const [newStartHour, newStartMinute] = timeSlot.split(':').map(Number);
        const newEndTotalMinutes = (newStartHour * 60 + newStartMinute) + originalDurationMinutes;
        const newEndHour = Math.floor(newEndTotalMinutes / 60);
        const newEndMinute = newEndTotalMinutes % 60;
        
        const newEndTime = `${newEndHour.toString().padStart(2, '0')}:${newEndMinute.toString().padStart(2, '0')}`;
        
        // Update both assignment and time
        await updateTask({
          taskId,
          updates: {
            startTime: timeSlot,
            endTime: newEndTime
          }
        });
      }
      
      await assignTask({ taskId, cleanerId, cleaners });
      toast({
        title: "Tarea asignada",
        description: timeSlot 
          ? `La tarea se ha asignado correctamente para las ${timeSlot}.`
          : "La tarea se ha asignada correctamente.",
      });
    } catch (error) {
      console.error('Error assigning task:', error);
      toast({
        title: "Error",
        description: "No se pudo asignar la tarea.",
        variant: "destructive",
      });
    }
  }, [tasks, updateTask, assignTask, toast, availability]);

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

  const handleCreateExtraordinaryService = useCallback(async (serviceData: any) => {
    console.log('🔵 useCalendarLogic - handleCreateExtraordinaryService called with:', serviceData);
    console.log('🔵 serviceData.notes:', serviceData.notes);
    
    // Convert extraordinary service data to task format
    const taskData: Omit<Task, 'id'> = {
      date: currentDate.toISOString().split('T')[0],
      startTime: '09:00', // Default start time
      endTime: (() => {
        const startMinutes = 9 * 60; // 09:00 in minutes
        const endMinutes = startMinutes + serviceData.serviceDuration;
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
      })(),
      checkIn: '09:00',
      checkOut: '09:00',
      property: serviceData.serviceAddress,
      address: serviceData.serviceAddress,
      type: 'trabajo-extraordinario',
      status: 'pending',
      cleaner: '',
      cleanerId: undefined,
      duration: serviceData.serviceDuration,
      cost: serviceData.serviceCost,
      paymentMethod: 'transferencia',
      supervisor: '',
      backgroundColor: '#8B5CF6',
      notes: serviceData.notes || '',
      clienteId: null, // Use null instead of empty string
      propertyId: null, // Use null instead of empty string
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('🔵 taskData with notes:', taskData.notes);

    try {
      const result = await createTask(taskData);
      console.log('✅ useCalendarLogic - createExtraordinaryService successful:', result);
      toast({
        title: "Servicio Extraordinario creado",
        description: `El servicio para ${serviceData.clientName} se ha creado correctamente.`,
      });
      setIsExtraordinaryServiceModalOpen(false);
    } catch (error) {
      console.error('❌ useCalendarLogic - createExtraordinaryService error:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el servicio extraordinario.",
        variant: "destructive",
      });
    }
  }, [createTask, toast, currentDate]);

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
    isLoading: isLoading || isLoadingAvailability,
    timeSlots,
    availability,
    
    // Refs
    headerScrollRef,
    bodyScrollRef,
    
    // Modal states
    isCreateModalOpen,
    setIsCreateModalOpen,
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
    setCurrentView,
    navigateDate,
    goToToday,
    handleNewTask,
    handleNewExtraordinaryService,
    handleCreateTask,
    handleCreateExtraordinaryService,
    handleTaskClick,
    handleUpdateTask,
    handleDeleteTask,
    handleDeleteAllTasks,
    handleUnassignTask
  };
};
