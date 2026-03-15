import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Task } from "@/types/calendar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from '@tanstack/react-query';
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
  onCreateTask?: (taskData: Omit<Task, 'id'>) => Promise<void>;
  openInEditMode?: boolean;
}
export const TaskDetailsModal = ({
  task,
  open,
  onOpenChange,
  onUpdateTask,
  onDeleteTask,
  onUnassignTask,
  onCreateTask,
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
  const queryClient = useQueryClient();
  const isRecurringInstance = !!(task as any)?.isRecurringInstance;
  
  useEffect(() => {
    if (task) {
      console.log('🔍 TaskDetailsModal useEffect - task:', task.id, 'openInEditMode:', openInEditMode);
      setFormData(task);
      setIsEditing(openInEditMode);
      console.log('🔍 TaskDetailsModal - isEditing set to:', openInEditMode);
    }
  }, [task, openInEditMode]);

  // FIXED: Todos los hooks están arriba. Este return condicional es seguro.
  // Solo retornamos null si no hay task - todos los hooks ya se ejecutaron.
  if (!task) return null;

  const handleSave = async () => {
    console.log('💾 handleSave called with formData:', formData);
    
    if (!formData.property || !formData.startTime || !formData.endTime) {
      toast({
        title: "Error",
        description: "Por favor completa los campos obligatorios.",
        variant: "destructive"
      });
      return;
    }

    // Handle virtual recurring task instances - materialize as a real task
    if (isRecurringInstance && onCreateTask) {
      try {
        const recurringTaskId = (task as any).recurringTaskId;
        
        // Build task data from the recurring instance + edited form data
        const { id, isRecurringInstance: _isRec, recurringTaskId: _rtId, originalTaskId, ...taskBase } = formData as any;
        const newTaskData: Omit<Task, 'id'> = {
          ...taskBase,
          property: formData.property || task.property,
          date: formData.date || task.date,
          startTime: formData.startTime || task.startTime,
          endTime: formData.endTime || task.endTime,
          status: formData.status || 'pending',
          type: formData.type || task.type,
          notes: formData.notes || task.notes,
        };
        // Remove virtual fields
        delete (newTaskData as any).isRecurringInstance;
        delete (newTaskData as any).recurringTaskId;
        delete (newTaskData as any).originalTaskId;

        await onCreateTask(newTaskData);

        // Record execution so the virtual instance disappears
        if (recurringTaskId) {
          await supabase.from('recurring_task_executions').insert({
            recurring_task_id: recurringTaskId,
            execution_date: formData.date || task.date,
            success: true,
          });
          queryClient.invalidateQueries({ queryKey: ['recurring-task-executions'] });
        }

        setIsEditing(false);
        onOpenChange(false);
        toast({
          title: "Tarea creada",
          description: "Se ha creado una tarea individual a partir de la tarea recurrente con los horarios modificados.",
        });
        return;
      } catch (error) {
        console.error('❌ Error materializing recurring task:', error);
        toast({
          title: "Error",
          description: "No se pudo crear la tarea individual.",
          variant: "destructive"
        });
        return;
      }
    }

    // Verificar si hay cambios en el horario para enviar email de notificación
    const hasScheduleChanges = 
      task.date !== formData.date ||
      task.startTime !== formData.startTime ||
      task.endTime !== formData.endTime;

    // Si hay cambios de horario y la tarea está asignada, enviar email de notificación
    if (hasScheduleChanges && task.cleanerId && task.cleaner) {
      try {
        await sendScheduleChangeEmail(task, formData);
      } catch (error) {
        console.error('❌ Error sending schedule change email:', error);
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
      console.log('📧 sendScheduleChangeEmail called');
      
      const { data: cleaner } = await supabase
        .from('cleaners')
        .select('email')
        .eq('id', originalTask.cleanerId)
        .single();

      if (!cleaner?.email) {
        console.log('❌ No email found for cleaner');
        return;
      }

      const { data: property } = await supabase
        .from('properties')
        .select('nombre, direccion')
        .eq('id', originalTask.propertyId)
        .single();

      // Asegurar que las horas estén en formato correcto antes de enviar
      const taskData = {
        property: property?.nombre || originalTask.property,
        address: property?.direccion || '',
        date: updatedData.date || originalTask.date,
        startTime: updatedData.startTime || originalTask.startTime,
        endTime: updatedData.endTime || originalTask.endTime,
        type: originalTask.type,
        notes: originalTask.notes
      };

      console.log('📧 Sending email with data:', taskData);

      const response = await supabase.functions.invoke('send-task-schedule-change-email', {
        body: {
          taskId: originalTask.id,
          cleanerEmail: cleaner.email,
          cleanerName: originalTask.cleaner,
          taskData,
          changes: {
            oldDate: originalTask.date,
            oldStartTime: originalTask.startTime,
            oldEndTime: originalTask.endTime
          }
        }
      });

      if (response.error) {
        throw response.error;
      }

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
    console.log('🔍 TaskDetailsModal - handleFieldChange called:', { field, value, taskId: task.id });
    console.log('🔍 Current task times:', { startTime: task.startTime, endTime: task.endTime });
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
          
          console.log('🕐 Original times:', { currentStartTime, currentEndTime });
          
          if (currentStartTime && currentEndTime) {
            // Normalizar tiempos (remover segundos si existen)
            const normalizeTime = (time: string) => {
              return time.includes(':') ? time.substring(0, 5) : time;
            };
            
            const normalizedStart = normalizeTime(currentStartTime);
            const normalizedEnd = normalizeTime(currentEndTime);
            const normalizedNewStart = normalizeTime(value);
            
            console.log('🕐 Normalized times:', { 
              normalizedStart, 
              normalizedEnd, 
              normalizedNewStart 
            });
            
            // Validar formato de tiempo (HH:MM después de normalizar)
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(normalizedStart) || !timeRegex.test(normalizedEnd) || !timeRegex.test(normalizedNewStart)) {
              console.error('❌ Invalid time format detected after normalization:', {
                normalizedStart: timeRegex.test(normalizedStart),
                normalizedEnd: timeRegex.test(normalizedEnd),
                normalizedNewStart: timeRegex.test(normalizedNewStart)
              });
              return newData;
            }
            
            // Calcular la duración original en minutos
            const [startHour, startMin] = normalizedStart.split(':').map(Number);
            const [endHour, endMin] = normalizedEnd.split(':').map(Number);
            const startTotalMin = startHour * 60 + startMin;
            const endTotalMin = endHour * 60 + endMin;
            let durationMin = endTotalMin - startTotalMin;
            
            // Si la duración es negativa, la tarea cruza medianoche
            if (durationMin < 0) {
              durationMin += 24 * 60; // Agregar 24 horas en minutos
              console.log('⏰ Task crosses midnight, adjusted duration:', durationMin);
            }
            
            // Calcular nueva hora de fin
            const [newStartHour, newStartMin] = normalizedNewStart.split(':').map(Number);
            const newStartTotalMin = newStartHour * 60 + newStartMin;
            const newEndTotalMin = newStartTotalMin + durationMin;
            
            const newEndHour = Math.floor(newEndTotalMin / 60) % 24;
            const newEndMin = newEndTotalMin % 60;
            
            const newEndTime = `${newEndHour.toString().padStart(2, '0')}:${newEndMin.toString().padStart(2, '0')}`;
            
            console.log('✅ New times calculated:', {
              originalDuration: durationMin + ' minutes',
              newStart: normalizedNewStart,
              newEnd: newEndTime
            });
            
            newData.endTime = newEndTime;
          }
        } catch (error) {
          console.error('❌ Error calculating end time:', error);
        }
      }

      console.log('📝 New form data:', newData);
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