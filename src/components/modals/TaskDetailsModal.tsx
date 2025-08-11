import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Task } from "@/types/calendar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { TaskReportModal } from "./TaskReportModal";
import { AssignMultipleCleanersModal } from "./AssignMultipleCleanersModal";
import { TaskDetailsHeader } from "./task-details/TaskDetailsHeader";
import { TaskDetailsForm } from "./task-details/TaskDetailsForm";
import { TaskDetailsActions } from "./task-details/TaskDetailsActions";
import { TaskDetailsConfirmDialogs } from "./task-details/TaskDetailsConfirmDialogs";
import { taskAssignmentService } from "@/services/storage/taskAssignmentService";
interface TaskDetailsModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onUnassignTask?: (taskId: string) => void;
  openInEditMode?: boolean;
}
export const TaskDetailsModal = ({
  task,
  open,
  onOpenChange,
  onUpdateTask,
  onDeleteTask,
  onUnassignTask,
  openInEditMode = false
}: TaskDetailsModalProps) => {
  const [isEditing, setIsEditing] = useState(openInEditMode);
  const [formData, setFormData] = useState<Partial<Task>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAssignMultipleModal, setShowAssignMultipleModal] = useState(false);
  const { userRole } = useAuth();
  const { toast } = useToast();
  
  useEffect(() => {
    if (task) {
      console.log('🔍 TaskDetailsModal useEffect - task:', task.id, 'openInEditMode:', openInEditMode);
      setFormData(task);
      setIsEditing(openInEditMode);
      console.log('🔍 TaskDetailsModal - isEditing set to:', openInEditMode);
    }
  }, [task, openInEditMode]);
  if (!task) return null;
  const handleSave = async () => {
    if (!formData.property || !formData.startTime || !formData.endTime) {
      toast({
        title: "Error",
        description: "Por favor completa los campos obligatorios.",
        variant: "destructive"
      });
      return;
    }

    // Verificar si hay cambios en el horario para enviar email de notificación
    const hasScheduleChanges = 
      task.date !== formData.date ||
      task.startTime !== formData.startTime ||
      task.endTime !== formData.endTime;

    // Si hay cambios de horario y la tarea está asignada, enviar email de notificación
    if (hasScheduleChanges && task.cleanerId && task.cleaner) {
      try {
        console.log('🔄 Schedule changed, sending notification email to cleaner');
        // Enviar email de cambio de horario
        await sendScheduleChangeEmail(task, formData);
      } catch (error) {
        console.error('Error sending schedule change email:', error);
        // No bloquear el guardado si falla el email
      }
    }

    onUpdateTask(task.originalTaskId || task.id, formData);
    setIsEditing(false);
    toast({
      title: "Tarea actualizada",
      description: "Los cambios se han guardado correctamente."
    });
  };

  const sendScheduleChangeEmail = async (originalTask: Task, updatedData: Partial<Task>) => {
    try {
      const { data: cleaner } = await supabase
        .from('cleaners')
        .select('email')
        .eq('id', originalTask.cleanerId)
        .single();

      if (!cleaner?.email) {
        console.log('No email found for cleaner');
        return;
      }

      const { data: property } = await supabase
        .from('properties')
        .select('nombre, direccion')
        .eq('id', originalTask.propertyId)
        .single();

      await supabase.functions.invoke('send-task-schedule-change-email', {
        body: {
          taskId: originalTask.id,
          cleanerEmail: cleaner.email,
          cleanerName: originalTask.cleaner,
          taskData: {
            property: property?.nombre || originalTask.property,
            address: property?.direccion || '',
            date: updatedData.date || originalTask.date,
            startTime: updatedData.startTime || originalTask.startTime,
            endTime: updatedData.endTime || originalTask.endTime,
            type: originalTask.type,
            notes: originalTask.notes
          },
          changes: {
            oldDate: originalTask.date,
            oldStartTime: originalTask.startTime,
            oldEndTime: originalTask.endTime
          }
        }
      });

      console.log('✅ Schedule change email sent successfully');
    } catch (error) {
      console.error('❌ Error sending schedule change email:', error);
      throw error;
    }
  };
  const handleDelete = () => {
    onDeleteTask(task.originalTaskId || task.id);
    onOpenChange(false);
    setShowDeleteConfirm(false);
    toast({
      title: "Tarea eliminada",
      description: "La tarea se ha eliminado correctamente."
    });
  };
  const handleUnassign = () => {
    if (onUnassignTask && task.cleaner) {
      onUnassignTask(task.originalTaskId || task.id);
      onOpenChange(false);
      setShowUnassignConfirm(false);
      toast({
        title: "Tarea desasignada",
        description: "La tarea se ha enviado a la lista de tareas sin asignar."
      });
    }
  };
  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };

      // Si se cambia la hora de inicio, calcular automáticamente la hora de fin manteniendo la duración
      if (field === 'startTime' && value) {
        try {
          // Usar los valores actuales del formulario o los valores de la tarea original
          const currentStartTime = task.startTime;
          const currentEndTime = task.endTime;
          
          if (currentStartTime && currentEndTime) {
            // Calcular la duración original de la tarea
            const originalStart = new Date(`2000-01-01T${currentStartTime}:00`);
            const originalEnd = new Date(`2000-01-01T${currentEndTime}:00`);
            const durationMs = originalEnd.getTime() - originalStart.getTime();
            
            // Calcular la nueva hora de fin
            const newStart = new Date(`2000-01-01T${value}:00`);
            const newEnd = new Date(newStart.getTime() + durationMs);
            
            // Formatear la nueva hora de fin (HH:MM)
            const newEndTime = newEnd.toTimeString().slice(0, 5);
            
            console.log('🕐 Calculating new end time:', {
              originalStart: currentStartTime,
              originalEnd: currentEndTime,
              newStart: value,
              newEnd: newEndTime,
              durationMs: durationMs / (1000 * 60) // en minutos
            });
            
            newData.endTime = newEndTime;
          }
        } catch (error) {
          console.error('Error calculating end time:', error);
        }
      }

      return newData;
    });
  };
  const handleCancel = () => {
    setIsEditing(false);
    setFormData(task);
  };

  const handleAssign = async (cleanerId: string, cleanerName: string) => {
    try {
      await taskAssignmentService.assignTask(task.originalTaskId || task.id, cleanerName, cleanerId);
      onUpdateTask(task.originalTaskId || task.id, { cleaner: cleanerName, cleanerId });
      toast({
        title: "Tarea asignada",
        description: `La tarea ha sido asignada a ${cleanerName}.`
      });
    } catch (error) {
      console.error('Error assigning task:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al asignar la tarea.",
        variant: "destructive"
      });
    }
  };
  return <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[600px] h-[90vh] sm:mx-auto mx-0 px-[25px] my-0 py-[6px] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <TaskDetailsHeader task={task} isEditing={isEditing} />
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4">
            <TaskDetailsForm task={task} isEditing={isEditing} formData={formData} onFieldChange={handleFieldChange} />
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-2">
            <TaskDetailsActions 
              task={task} 
              isEditing={isEditing} 
              onEdit={userRole !== 'cleaner' ? () => setIsEditing(true) : undefined} 
              onSave={handleSave} 
              onCancel={handleCancel} 
              onDelete={userRole !== 'cleaner' ? () => setShowDeleteConfirm(true) : undefined} 
              onUnassign={userRole !== 'cleaner' && onUnassignTask ? () => setShowUnassignConfirm(true) : undefined}
              onAssign={userRole !== 'cleaner' ? handleAssign : undefined}
              onAssignMultiple={userRole !== 'cleaner' ? () => setShowAssignMultipleModal(true) : undefined}
              onOpenReport={() => setShowReportModal(true)}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Report Modal */}
      <TaskReportModal task={task} open={showReportModal} onOpenChange={setShowReportModal} />

      {/* Assign Multiple Cleaners Modal */}
      <AssignMultipleCleanersModal 
        task={task} 
        open={showAssignMultipleModal} 
        onOpenChange={setShowAssignMultipleModal}
        onAssignComplete={() => {
          // Refresh the task data if needed
          console.log('Multiple cleaners assigned');
        }}
      />

      <TaskDetailsConfirmDialogs task={task} showDeleteConfirm={showDeleteConfirm} onDeleteConfirmChange={setShowDeleteConfirm} showUnassignConfirm={showUnassignConfirm} onUnassignConfirmChange={setShowUnassignConfirm} onConfirmDelete={handleDelete} onConfirmUnassign={handleUnassign} />
    </>;
};