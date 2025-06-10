
import { useState, useMemo, useRef } from "react";
import { useCalendarData } from "@/hooks/useCalendarData";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@/types/calendar";

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
    createTask,
    deleteTask
  } = useCalendarData();

  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  
  // Refs for scroll synchronization
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);

  // Generate time slots
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

  // Handle task assignment with optional time slot
  const handleTaskAssign = async (taskId: string, cleanerId: string, cleaners: any[], timeSlot?: string) => {
    console.log('useCalendarLogic - handleTaskAssign called with:', { taskId, cleanerId, cleaners, timeSlot });
    try {
      // If timeSlot is provided, also update the task's start time
      if (timeSlot) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
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
  };

  // Initialize drag and drop
  const {
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop
  } = useDragAndDrop(handleTaskAssign);

  // Handle new task creation
  const handleNewTask = () => {
    setIsCreateModalOpen(true);
  };

  // Handle task creation
  const handleCreateTask = async (taskData: Omit<Task, 'id'>) => {
    try {
      await createTask(taskData);
      toast({
        title: "Tarea creada",
        description: "La nueva tarea se ha creado correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo crear la tarea.",
        variant: "destructive",
      });
    }
  };

  // Handle task details
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  // Handle task update
  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      await updateTask({ taskId, updates });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar la tarea.",
        variant: "destructive",
      });
    }
  };

  // Handle task deletion
  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la tarea.",
        variant: "destructive",
      });
    }
  };

  // Handle task unassignment
  const handleUnassignTask = async (taskId: string) => {
    try {
      await updateTask({ 
        taskId, 
        updates: { 
          cleaner: null, 
          cleanerId: null 
        } 
      });
      toast({
        title: "Tarea desasignada",
        description: "La tarea se ha enviado a la lista de tareas sin asignar.",
      });
    } catch (error) {
      console.error('Error unassigning task:', error);
      toast({
        title: "Error",
        description: "No se pudo desasignar la tarea.",
        variant: "destructive",
      });
    }
  };

  return {
    // Data
    tasks,
    cleaners,
    currentDate,
    currentView,
    isLoading,
    timeSlots,
    
    // Refs
    headerScrollRef,
    bodyScrollRef,
    
    // Modal states
    isCreateModalOpen,
    setIsCreateModalOpen,
    selectedTask,
    isTaskModalOpen,
    setIsTaskModalOpen,
    
    // Drag and drop
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    
    // Actions
    setCurrentView,
    navigateDate,
    goToToday,
    handleNewTask,
    handleCreateTask,
    handleTaskClick,
    handleUpdateTask,
    handleDeleteTask,
    handleUnassignTask
  };
};
