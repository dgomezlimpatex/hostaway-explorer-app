
import { useState } from 'react';
import { Task } from "@/types/calendar";
import { useTasks } from '@/hooks/useTasks';
import { useToast } from '@/hooks/use-toast';

export const useTaskActions = () => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openInEditMode, setOpenInEditMode] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [taskToAssign, setTaskToAssign] = useState<Task | null>(null);
  const { updateTask, deleteTask, assignTask } = useTasks(new Date(), 'day');
  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "in-progress":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "pending":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Completado";
      case "in-progress":
        return "En Progreso";
      case "pending":
        return "Pendiente";
      default:
        return "Desconocido";
    }
  };

  const handleEditTask = (task: Task) => {
    console.log('🔍 useTaskActions handleEditTask called with task:', task.id);
    setSelectedTask(task);
    setOpenInEditMode(true);
    setIsModalOpen(true);
    console.log('🔍 useTaskActions modal state set - openInEditMode: true, isModalOpen: true');
  };

  const handleDeleteTask = (taskId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
      deleteTask(taskId);
      toast({
        title: "Tarea eliminada",
        description: "La tarea se ha eliminado correctamente.",
      });
    }
  };

  const handleUpdateTask = (taskId: string, updates: Partial<Task>) => {
    updateTask({ taskId, updates });
    toast({
      title: "Tarea actualizada",
      description: "Los cambios se han guardado correctamente.",
    });
  };

  const handleQuickStatusChange = (taskId: string, newStatus: string) => {
    updateTask({ 
      taskId, 
      updates: { status: newStatus as "completed" | "in-progress" | "pending" }
    });
    toast({
      title: "Estado actualizado",
      description: `La tarea se marcó como ${getStatusText(newStatus).toLowerCase()}.`,
    });
  };

  const handleAssignCleaner = (task: Task) => {
    setTaskToAssign(task);
    setIsAssignModalOpen(true);
  };

  const handleAssignCleanerComplete = (taskId: string, cleanerId: string, cleaners: any[]) => {
    assignTask({ taskId, cleanerId, cleaners });
  };

  const handleModalClose = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setOpenInEditMode(false);
    }
  };

  return {
    selectedTask,
    isModalOpen,
    setIsModalOpen,
    openInEditMode,
    handleModalClose,
    isAssignModalOpen,
    setIsAssignModalOpen,
    taskToAssign,
    getStatusColor,
    getStatusText,
    handleEditTask,
    handleDeleteTask,
    handleUpdateTask,
    handleQuickStatusChange,
    handleAssignCleaner,
    handleAssignCleanerComplete,
  };
};
